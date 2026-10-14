#!/usr/bin/env python3
"""
NARU Research: analyze the latest official Shokuba Rabo all-company CSV.

Source:
https://shokuba.mhlw.go.jp/shokuba/utilize/download010?lang=JA

The raw provider file is downloaded at runtime and is NOT committed.
Only aggregate results and a compact seed list for information/communications
companies are written under data/research/shokuba/.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://shokuba.mhlw.go.jp/shokuba/utilize/download010?lang=JA"
SOURCE_PAGE = "https://shokuba.mhlw.go.jp/shokuba/utilize/utilize010.do"
DEFINITION_URL = "https://shokuba.mhlw.go.jp/manual/aboutcsv.pdf"
OUT_DIR = Path("data/research/shokuba")
OUT_DIR.mkdir(parents=True, exist_ok=True)

RUN_DATE = "2026-10-04"
SUMMARY_PATH = OUT_DIR / f"{RUN_DATE}-summary.json"
SEED_PATH = OUT_DIR / f"{RUN_DATE}-information-communications-seed.csv"


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; NARUResearch/1.0; +https://naru-career.com/)"
        },
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def extract_payload(blob: bytes) -> tuple[bytes, str]:
    bio = io.BytesIO(blob)
    if zipfile.is_zipfile(bio):
        bio.seek(0)
        with zipfile.ZipFile(bio) as zf:
            members = [
                n for n in zf.namelist()
                if not n.endswith("/") and n.lower().endswith((".csv", ".txt"))
            ]
            if not members:
                raise RuntimeError("ZIP downloaded but no CSV/TXT member found")
            # Prefer the largest CSV/TXT member.
            member = max(members, key=lambda n: zf.getinfo(n).file_size)
            return zf.read(member), f"zip:{member}"
    return blob, "raw"


def decode_text(blob: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "cp932", "shift_jis", "utf-8"):
        try:
            return blob.decode(enc), enc
        except UnicodeDecodeError:
            pass
    raise RuntimeError("Could not decode provider file with expected encodings")


def find_header(headers: list[str], *needles: str) -> str | None:
    for h in headers:
        normalized = h.replace("\n", "").replace("\r", "").replace(" ", "")
        if all(n.replace(" ", "") in normalized for n in needles):
            return h
    return None


def find_headers(headers: list[str], *needles: str) -> list[str]:
    out = []
    for h in headers:
        normalized = h.replace("\n", "").replace("\r", "").replace(" ", "")
        if all(n.replace(" ", "") in normalized for n in needles):
            out.append(h)
    return out


_num_re = re.compile(r"-?\d+(?:\.\d+)?")


def parse_numbers(value: str | None) -> list[float]:
    if not value:
        return []
    return [float(x) for x in _num_re.findall(value.replace(",", ""))]


def parse_three_year_count(value: str | None) -> tuple[int | None, int]:
    if not value or not value.strip():
        return None, 0
    nums = parse_numbers(value)
    if not nums:
        return None, 0
    return int(sum(nums)), len(nums)


def yes_no(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    v = value.strip()
    if "有" in v and "無" not in v:
        return "yes"
    if "無" in v:
        return "no"
    # Preserve disclosed-but-nonstandard values as other.
    return "other"


def first_number(value: str | None) -> float | None:
    nums = parse_numbers(value)
    return nums[0] if nums else None


def summarize_yes_no(rows: list[dict[str, str]], header: str | None) -> dict:
    if not header:
        return {"header": None, "disclosed": 0, "yes": 0, "no": 0, "other": 0, "yesRateAmongDisclosed": None}
    c = Counter(yes_no(r.get(header)) for r in rows)
    disclosed = c["yes"] + c["no"] + c["other"]
    return {
        "header": header,
        "disclosed": disclosed,
        "yes": c["yes"],
        "no": c["no"],
        "other": c["other"],
        "yesRateAmongDisclosed": (c["yes"] / disclosed) if disclosed else None,
    }


def main() -> None:
    blob = download_bytes(SOURCE_URL)
    raw, container_type = extract_payload(blob)
    text, encoding = decode_text(raw)

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = list(reader)
    if not headers or not rows:
        raise RuntimeError("Provider CSV parsed as empty")

    industry_h = find_header(headers, "業種")
    company_h = find_header(headers, "企業名")
    corp_h = find_header(headers, "法人番号")
    pref_h = find_header(headers, "都道府県")
    size_h = find_header(headers, "企業規模")
    site_h = find_header(headers, "企業ホームページ")
    recruit_h = find_header(headers, "採用ページ")

    young_total_h = find_header(headers, "新卒者等以外", "35歳未満", "男女計")
    young_leave_h = find_header(headers, "新卒者等以外", "35歳未満", "離職者数")
    mid_ratio_h = find_header(headers, "中途採用比率", "前年度")

    training_h = find_header(headers, "研修制度", "有無")
    mentor_h = find_header(headers, "メンター制度", "有無")
    selfdev_h = find_header(headers, "自己啓発支援制度", "有無")
    career_h = find_header(headers, "キャリアコンサルティング制度", "有無")
    onboarding_h = find_header(headers, "オンボーディング制度")
    qualification_h = find_header(headers, "取得可能資格")

    # Keep candidate headers in the result so editorial review can select the
    # appropriate metric without silently guessing.
    overtime_headers = sorted(set(
        find_headers(headers, "所定外") +
        find_headers(headers, "残業時間")
    ))
    tenure_headers = find_headers(headers, "平均継続勤務年数")
    age_headers = find_headers(headers, "平均年齢")
    paidleave_headers = sorted(set(
        find_headers(headers, "有給休暇", "取得") +
        find_headers(headers, "年次有給休暇", "取得")
    ))

    if not industry_h:
        raise RuntimeError("Could not locate 業種 header")

    info_rows = [
        r for r in rows
        if "情報通信業" in (r.get(industry_h) or "")
    ]

    young_records = []
    for r in info_rows:
        hires, hire_n = parse_three_year_count(r.get(young_total_h)) if young_total_h else (None, 0)
        leavers, leave_n = parse_three_year_count(r.get(young_leave_h)) if young_leave_h else (None, 0)
        if hires is not None or leavers is not None:
            young_records.append((hires, leavers, hire_n, leave_n))

    complete_young = [
        (h, l) for h, l, hn, ln in young_records
        if h is not None and l is not None and hn > 0 and ln > 0 and h > 0
    ]
    young_hires_total = sum(h for h, _ in complete_young)
    young_leavers_total = sum(l for _, l in complete_young)

    recruitment_url_count = sum(1 for r in info_rows if recruit_h and (r.get(recruit_h) or "").strip())
    homepage_url_count = sum(1 for r in info_rows if site_h and (r.get(site_h) or "").strip())
    onboarding_disclosed = sum(1 for r in info_rows if onboarding_h and (r.get(onboarding_h) or "").strip())
    qualification_disclosed = sum(1 for r in info_rows if qualification_h and (r.get(qualification_h) or "").strip())

    size_counter = Counter((r.get(size_h) or "").strip() for r in info_rows) if size_h else Counter()
    prefecture_counter = Counter((r.get(pref_h) or "").strip() for r in info_rows) if pref_h else Counter()

    middle_ratios = []
    if mid_ratio_h:
        for r in info_rows:
            vals = parse_numbers(r.get(mid_ratio_h))
            if vals:
                middle_ratios.extend(vals)

    summary = {
        "runDate": RUN_DATE,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "source": {
            "downloadUrl": SOURCE_URL,
            "sourcePage": SOURCE_PAGE,
            "definitionUrl": DEFINITION_URL,
            "downloadBytes": len(blob),
            "payloadBytes": len(raw),
            "containerType": container_type,
            "encoding": encoding,
        },
        "dataset": {
            "allCompanyRows": len(rows),
            "columnCount": len(headers),
            "informationCommunicationsRows": len(info_rows),
            "industryHeader": industry_h,
            "informationCommunicationsShare": len(info_rows) / len(rows) if rows else None,
        },
        "headersUsed": {
            "company": company_h,
            "corporateNumber": corp_h,
            "prefecture": pref_h,
            "companySize": size_h,
            "homepage": site_h,
            "recruitmentPage": recruit_h,
            "youngUnder35Total": young_total_h,
            "youngUnder35Leavers": young_leave_h,
            "midCareerRatio": mid_ratio_h,
            "training": training_h,
            "mentor": mentor_h,
            "selfDevelopment": selfdev_h,
            "careerConsulting": career_h,
            "onboarding": onboarding_h,
            "qualification": qualification_h,
        },
        "coverage": {
            "homepageUrl": {
                "count": homepage_url_count,
                "rate": homepage_url_count / len(info_rows) if info_rows else None,
            },
            "recruitmentPageUrl": {
                "count": recruitment_url_count,
                "rate": recruitment_url_count / len(info_rows) if info_rows else None,
            },
            "onboardingText": {
                "count": onboarding_disclosed,
                "rate": onboarding_disclosed / len(info_rows) if info_rows else None,
            },
            "qualificationText": {
                "count": qualification_disclosed,
                "rate": qualification_disclosed / len(info_rows) if info_rows else None,
            },
        },
        "developmentSystems": {
            "training": summarize_yes_no(info_rows, training_h),
            "mentor": summarize_yes_no(info_rows, mentor_h),
            "selfDevelopment": summarize_yes_no(info_rows, selfdev_h),
            "careerConsulting": summarize_yes_no(info_rows, career_h),
        },
        "youngUnder35": {
            "rowsWithAnyData": len(young_records),
            "rowsWithCompletePositiveHireData": len(complete_young),
            "threeYearHiresTotalAmongCompletePositiveRows": young_hires_total,
            "threeYearLeaversTotalAmongCompletePositiveRows": young_leavers_total,
            "leaversPerHireRatioAmongCompletePositiveRows": (
                young_leavers_total / young_hires_total if young_hires_total else None
            ),
            "interpretationWarning": (
                "This is leavers divided by hires across the disclosed three-year fields, "
                "not a cohort survival/retention rate. Do not label it 定着率 without further validation."
            ),
        },
        "midCareerRatio": {
            "header": mid_ratio_h,
            "disclosedValues": len(middle_ratios),
            "simpleAverageAcrossDisclosedYearValues": (
                sum(middle_ratios) / len(middle_ratios) if middle_ratios else None
            ),
            "note": "Simple average across disclosed annual percentage values; not weighted by hiring volume.",
        },
        "candidateMetricHeaders": {
            "overtime": overtime_headers,
            "averageTenure": tenure_headers,
            "averageAge": age_headers,
            "paidLeave": paidleave_headers,
        },
        "topCompanySizes": size_counter.most_common(20),
        "topPrefectures": prefecture_counter.most_common(20),
    }

    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    seed_headers = [
        x for x in [
            corp_h, company_h, pref_h, size_h, industry_h, site_h, recruit_h,
            young_total_h, young_leave_h, mid_ratio_h,
            training_h, mentor_h, selfdev_h, career_h, onboarding_h,
        ] if x
    ]
    # Deduplicate while preserving order.
    seed_headers = list(dict.fromkeys(seed_headers))
    with SEED_PATH.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=seed_headers, extrasaction="ignore")
        w.writeheader()
        for r in info_rows:
            w.writerow({h: r.get(h, "") for h in seed_headers})

    print(json.dumps({
        "summaryPath": str(SUMMARY_PATH),
        "seedPath": str(SEED_PATH),
        "allRows": len(rows),
        "informationCommunicationsRows": len(info_rows),
        "recruitmentPageUrlCount": recruitment_url_count,
        "youngCompletePositiveRows": len(complete_young),
        "training": summary["developmentSystems"]["training"],
        "mentor": summary["developmentSystems"]["mentor"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise
