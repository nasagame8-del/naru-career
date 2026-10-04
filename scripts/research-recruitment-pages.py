#!/usr/bin/env python3
"""
NARU Research stage 2: crawl official recruitment pages listed in the
Shokuba Rabo information/communications seed.

Scope is deliberately narrow and conservative:
- only explicit official recruitment URLs already published in Shokuba Rabo
- no login, no anti-bot bypass, no JavaScript browser automation
- robots.txt respected when available
- small concurrency and response-size cap
- only structured facts / keyword flags are retained; page bodies are not stored
"""
from __future__ import annotations

import csv
import html
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

RUN_DATE = "2026-10-04"
IN_PATH = Path(f"data/research/shokuba/{RUN_DATE}-information-communications-seed.csv")
OUT_DIR = Path("data/research/shokuba")
OUT_JSON = OUT_DIR / f"{RUN_DATE}-recruitment-pages-pilot.json"
OUT_CSV = OUT_DIR / f"{RUN_DATE}-recruitment-pages-pilot.csv"

USER_AGENT = "NARUResearch/1.0 (+https://naru-career.com/; public recruitment-page research)"
TIMEOUT = 12
MAX_BYTES = 2_000_000
MAX_WORKERS = 6

KEYWORDS = {
    "secondNewGrad": ["第二新卒"],
    "entryLevel": ["未経験", "経験不問", "未経験者歓迎", "職種未経験"],
    "recentGraduate": ["既卒"],
    "potentialHire": ["ポテンシャル採用", "ポテンシャル"],
    "training": ["研修"],
    "mentor": ["メンター"],
    "remote": ["リモート", "在宅勤務", "テレワーク"],
    "fullRemote": ["フルリモート", "完全在宅"],
    "engineer": ["エンジニア", "プログラマ", "プログラマー", "SE"],
    "webMarketing": ["Webマーケ", "WEBマーケ", "webマーケ", "デジタルマーケティング"],
    "webDirector": ["Webディレクター", "WEBディレクター", "webディレクター"],
    "portfolio": ["ポートフォリオ"],
    "workExperience": ["実務経験"],
    "salary": ["年収", "月給", "給与"],
}

robots_lock = threading.Lock()
robots_cache: dict[str, tuple[urllib.robotparser.RobotFileParser | None, str | None]] = {}


class VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden_depth = 0
        self.title_parts: list[str] = []
        self.in_title = False
        self.jsonld_parts: list[str] = []
        self.in_jsonld = False

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            if tag == "script" and attr.get("type", "").lower() == "application/ld+json":
                self.in_jsonld = True
                return
            self.hidden_depth += 1
        elif tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "script" and self.in_jsonld:
            self.in_jsonld = False
            return
        if tag in {"script", "style", "noscript", "svg"} and self.hidden_depth > 0:
            self.hidden_depth -= 1
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_jsonld:
            self.jsonld_parts.append(data)
            return
        if self.in_title:
            self.title_parts.append(data)
        if self.hidden_depth == 0:
            t = data.strip()
            if t:
                self.parts.append(t)

    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()

    def title(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.title_parts)).strip()

    def jsonld(self) -> str:
        return "\n".join(self.jsonld_parts)


def decode_html(blob: bytes, content_type: str | None) -> str:
    candidates = []
    if content_type:
        m = re.search(r"charset=([^;\s]+)", content_type, flags=re.I)
        if m:
            candidates.append(m.group(1).strip("'\""))
    head = blob[:5000].decode("ascii", errors="ignore")
    m = re.search(r"<meta[^>]+charset=[\"']?([^\"'\s/>]+)", head, flags=re.I)
    if m:
        candidates.append(m.group(1))
    candidates += ["utf-8", "cp932", "shift_jis", "euc-jp"]
    seen = set()
    for enc in candidates:
        key = enc.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            return blob.decode(enc)
        except Exception:
            pass
    return blob.decode("utf-8", errors="replace")


def robots_allowed(url: str) -> tuple[bool, str | None]:
    p = urllib.parse.urlparse(url)
    origin = f"{p.scheme}://{p.netloc}"
    with robots_lock:
        cached = robots_cache.get(origin)

    if cached is None:
        robots_url = urllib.parse.urljoin(origin, "/robots.txt")
        rp = None
        note = None
        try:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(robots_url)
            req = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as res:
                txt = res.read(500_000).decode("utf-8", errors="ignore")
            rp.parse(txt.splitlines())
        except Exception as e:
            # A missing/unreachable robots file is not treated as an explicit prohibition.
            rp = None
            note = f"robots_unavailable:{type(e).__name__}"
        with robots_lock:
            robots_cache[origin] = (rp, note)
        cached = (rp, note)

    rp, note = cached
    if rp is None:
        return True, note
    allowed = rp.can_fetch(USER_AGENT, url)
    return allowed, (note if allowed else "blocked_by_robots")


def flatten_jsonld(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from flatten_jsonld(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from flatten_jsonld(v)


def detect_jobposting(jsonld_text: str) -> tuple[bool, list[str]]:
    if not jsonld_text.strip():
        return False, []
    # Multiple script blocks may have been concatenated. Try small JSON slices first,
    # then fall back to a type-name presence check.
    titles: list[str] = []
    has = False
    for raw in re.findall(r"\{.*?\}", jsonld_text, flags=re.S):
        try:
            obj = json.loads(raw)
        except Exception:
            continue
        for node in flatten_jsonld(obj):
            typ = node.get("@type")
            types = typ if isinstance(typ, list) else [typ]
            if any(str(t).lower() == "jobposting" for t in types if t):
                has = True
                title = node.get("title")
                if isinstance(title, str) and title.strip():
                    titles.append(re.sub(r"\s+", " ", html.unescape(title)).strip())
    if not has and "JobPosting" in jsonld_text:
        has = True
    return has, list(dict.fromkeys(titles))[:10]


def fetch_page(url: str) -> dict:
    allowed, robots_note = robots_allowed(url)
    if not allowed:
        return {
            "ok": False,
            "status": None,
            "finalUrl": None,
            "title": None,
            "contentType": None,
            "bytesRead": 0,
            "robots": robots_note,
            "error": "blocked_by_robots",
        }

    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "Accept-Language": "ja,en;q=0.5",
    })
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            status = getattr(res, "status", 200)
            final_url = res.geturl()
            ctype = res.headers.get("Content-Type")
            blob = res.read(MAX_BYTES + 1)
        truncated = len(blob) > MAX_BYTES
        if truncated:
            blob = blob[:MAX_BYTES]
        if ctype and "html" not in ctype.lower():
            return {
                "ok": False, "status": status, "finalUrl": final_url,
                "title": None, "contentType": ctype, "bytesRead": len(blob),
                "robots": robots_note, "error": "non_html_content",
            }
        text = decode_html(blob, ctype)
        parser = VisibleTextParser()
        parser.feed(text)
        visible = parser.text()
        flags = {
            name: any(k.lower() in visible.lower() for k in kws)
            for name, kws in KEYWORDS.items()
        }
        has_jobposting, job_titles = detect_jobposting(parser.jsonld())
        return {
            "ok": True,
            "status": status,
            "finalUrl": final_url,
            "title": parser.title()[:500] or None,
            "contentType": ctype,
            "bytesRead": len(blob),
            "truncated": truncated,
            "robots": robots_note,
            "flags": flags,
            "jobPostingJsonLd": has_jobposting,
            "jobPostingTitles": job_titles,
            "visibleChars": len(visible),
            "error": None,
        }
    except urllib.error.HTTPError as e:
        return {
            "ok": False, "status": e.code, "finalUrl": getattr(e, "url", url),
            "title": None, "contentType": None, "bytesRead": 0,
            "robots": robots_note, "error": f"HTTPError:{e.code}",
        }
    except Exception as e:
        return {
            "ok": False, "status": None, "finalUrl": None,
            "title": None, "contentType": None, "bytesRead": 0,
            "robots": robots_note, "error": f"{type(e).__name__}:{str(e)[:200]}",
        }


def main():
    if not IN_PATH.exists():
        raise SystemExit(f"Missing seed: {IN_PATH}")

    with IN_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    company_h = "企業名"
    corp_h = "法人番号"
    recruit_h = "採用ページ"
    homepage_h = "企業ホームページ"

    targets = []
    for r in rows:
        url = (r.get(recruit_h) or "").strip()
        if not url:
            continue
        if not re.match(r"^https?://", url, flags=re.I):
            continue
        targets.append({
            "corporateNumber": (r.get(corp_h) or "").strip(),
            "company": (r.get(company_h) or "").strip(),
            "recruitmentUrl": url,
            "homepageUrl": (r.get(homepage_h) or "").strip(),
        })

    # Deduplicate by URL while keeping first company mapping.
    dedup = {}
    for t in targets:
        dedup.setdefault(t["recruitmentUrl"], t)
    targets = list(dedup.values())

    results = []
    started = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        future_map = {ex.submit(fetch_page, t["recruitmentUrl"]): t for t in targets}
        for fut in as_completed(future_map):
            t = future_map[fut]
            page = fut.result()
            results.append({**t, **page})

    results.sort(key=lambda x: (x.get("company") or "", x.get("recruitmentUrl") or ""))

    ok = [r for r in results if r.get("ok")]
    flag_counts = {
        name: sum(1 for r in ok if (r.get("flags") or {}).get(name))
        for name in KEYWORDS
    }
    jobposting_count = sum(1 for r in ok if r.get("jobPostingJsonLd"))
    status_counts = {}
    error_counts = {}
    for r in results:
        status_key = str(r.get("status") if r.get("status") is not None else "none")
        status_counts[status_key] = status_counts.get(status_key, 0) + 1
        if r.get("error"):
            error_counts[r["error"]] = error_counts.get(r["error"], 0) + 1

    summary = {
        "runDate": RUN_DATE,
        "scope": "Explicit recruitment-page URLs in the Shokuba Rabo information/communications seed only",
        "targetCount": len(targets),
        "successCount": len(ok),
        "successRate": len(ok) / len(targets) if targets else None,
        "elapsedSeconds": round(time.time() - started, 2),
        "jobPostingJsonLdCount": jobposting_count,
        "keywordCountsAmongSuccessfulPages": flag_counts,
        "keywordRatesAmongSuccessfulPages": {
            k: v / len(ok) if ok else None for k, v in flag_counts.items()
        },
        "statusCounts": status_counts,
        "errorCounts": error_counts,
        "methodNotes": [
            "Only public official recruitment URLs explicitly listed in Shokuba Rabo were requested.",
            "robots.txt is respected when it explicitly disallows the URL.",
            "No login, anti-bot bypass, JavaScript browser automation, or full-page text storage is used.",
            "Keyword flags indicate only that the term appears somewhere on the fetched page; they do not prove an open job with that condition.",
            "This pilot is for source discovery and article-design decisions, not a final market estimate.",
        ],
        "results": results,
    }
    OUT_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    fieldnames = [
        "corporateNumber","company","recruitmentUrl","homepageUrl","ok","status","finalUrl",
        "title","robots","jobPostingJsonLd","jobPostingTitles","visibleChars","error",
        *KEYWORDS.keys(),
    ]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            flags = r.get("flags") or {}
            row = {k: r.get(k) for k in fieldnames}
            row["jobPostingTitles"] = " | ".join(r.get("jobPostingTitles") or [])
            for k in KEYWORDS:
                row[k] = flags.get(k, False)
            w.writerow(row)

    print(json.dumps({
        "targetCount": len(targets),
        "successCount": len(ok),
        "jobPostingJsonLdCount": jobposting_count,
        "keywordCounts": flag_counts,
        "out": str(OUT_JSON),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
