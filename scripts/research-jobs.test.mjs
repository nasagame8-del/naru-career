import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSalary,
  extractExperienceYears,
  extractEmploymentType,
  extractLocation,
  extractRequirementExcerpt,
  cleanJobTitle,
  pickJobTitle,
  looksLikeJobDetail,
} from "./research-jobs.mjs";
import { matchFlags, parseRobots, parseSitemap, extractAnchors, extractJobPostings } from "./research-web.mjs";

const REQUIRED_LABELS = ["必須スキル", "必須条件", "応募資格"];
const PREFERRED_LABELS = ["歓迎スキル", "歓迎条件", "あると望ましい"];

// ── 給与 ──

test("年収レンジを年額の円に変換する", () => {
  const r = extractSalary("想定年収 400万円〜650万円（経験を考慮）");
  assert.equal(r.salaryMin, 4_000_000);
  assert.equal(r.salaryMax, 6_500_000);
  assert.equal(r.salaryUnit, "YEAR");
});

test("年収が下限のみならmaxはnullのまま", () => {
  const r = extractSalary("年収350万円以上");
  assert.equal(r.salaryMin, 3_500_000);
  assert.equal(r.salaryMax, null);
  assert.equal(r.salaryUnit, "YEAR");
});

test("月給は月額として保持し、年額に換算しない", () => {
  const r = extractSalary("月給 250,000円 〜 400,000円");
  assert.equal(r.salaryMin, 250_000);
  assert.equal(r.salaryMax, 400_000);
  assert.equal(r.salaryUnit, "MONTH");
});

test("全角数字の月給も読める", () => {
  const r = extractSalary("月給２２万円〜３５万円");
  assert.equal(r.salaryMin, 220_000);
  assert.equal(r.salaryMax, 350_000);
  assert.equal(r.salaryUnit, "MONTH");
});

test("給与の記載がなければ全てnull（0にしない）", () => {
  const r = extractSalary("当社規定により優遇します");
  assert.deepEqual(r, { salaryMin: null, salaryMax: null, salaryUnit: null, salarySource: null });
});

// ── 必須経験年数 ──

test("「実務経験3年以上」から3を取る", () => {
  assert.equal(extractExperienceYears("Javaでの実務経験3年以上"), 3);
});

test("「5年以上の開発経験」の語順でも取れる", () => {
  assert.equal(extractExperienceYears("5年以上の開発経験をお持ちの方"), 5);
});

test("経験不問は年数不明なのでnull（0と書かない）", () => {
  assert.equal(extractExperienceYears("未経験・経験不問"), null);
});

// ── 雇用形態 / 勤務地 ──

test("雇用形態は記載された語だけを返す", () => {
  assert.equal(extractEmploymentType("雇用形態：正社員（試用期間3ヶ月）"), "正社員");
  assert.equal(extractEmploymentType("特に記載なし"), null);
});

test("勤務地ラベルがある場合だけ都道府県を返す", () => {
  assert.equal(extractLocation("勤務地：東京都渋谷区"), "東京都");
  assert.equal(extractLocation("弊社は東京で創業しました"), null);
});

// ── 応募資格の抜粋 ──

test("応募資格の抜粋は次の見出しで打ち切る", () => {
  const text = "応募資格：Javaでの開発経験 給与：年収400万円〜 勤務地：東京都";
  const got = extractRequirementExcerpt(text, REQUIRED_LABELS);
  assert.ok(got.startsWith("応募資格: Javaでの開発経験"));
  assert.ok(!got.includes("年収400万円"));
});

test("「歓迎します」のような本文中の語は歓迎スキルにしない", () => {
  assert.equal(extractRequirementExcerpt("経験者を歓迎します。お問い合わせください", PREFERRED_LABELS), null);
});

// ── 求人タイトル ──

test("会社名をタイトルから除去する", () => {
  assert.equal(cleanJobTitle("Webエンジニア | 株式会社ニックス", "株式会社ニックス"), "Webエンジニア");
});

test("サイト全体の見出しよりも職種名を優先する", () => {
  const got = pickJobTitle({
    headings: ["Recruit 採用情報"],
    pageTitle: "採用情報 | 株式会社サンプル",
    anchor: "システムエンジニア（中途）",
    company: "株式会社サンプル",
  });
  // NFKC正規化で全角括弧は半角になる。
  assert.equal(got.jobTitle, "システムエンジニア(中途)");
  assert.equal(got.jobTitleSource, "anchor");
});

test("候補が無ければjobTitleはnull", () => {
  assert.deepEqual(pickJobTitle({}), { jobTitle: null, jobTitleSource: null });
});

// ── 求人詳細かどうか ──

test("募集要項の体裁があるページだけ求人詳細とみなす", () => {
  assert.equal(looksLikeJobDetail("募集要項 雇用形態 正社員 給与 月給25万円", "エンジニア"), true);
  assert.equal(looksLikeJobDetail("当社は1990年創業のシステム会社です", "会社概要"), false);
});

// ── キーワードフラグ ──

test("SEは単語境界で判定し、servicesに誤反応しない", () => {
  assert.equal(matchFlags("We provide IT services for clients").flags.engineer, false);
  assert.equal(matchFlags("SE・PG募集").flags.engineer, true);
});

test("ポテンシャルは明示表現のみを採用する", () => {
  assert.equal(matchFlags("あなたのポテンシャルを発揮してください").flags.potentialHire, false);
  assert.equal(matchFlags("ポテンシャル採用を実施中").flags.potentialHire, true);
});

test("一致した語をflagTermsに残す", () => {
  const { flagTerms } = matchFlags("第二新卒・未経験歓迎、フルリモート可");
  assert.deepEqual(flagTerms.secondNewGrad, ["第二新卒"]);
  // 「フルリモ」は「フルリモート」の部分一致なので両方並ぶ。語の記録なので許容する。
  assert.ok(flagTerms.fullRemote.includes("フルリモート"));
  assert.equal(flagTerms.inexperienced.includes("未経験"), true);
});

test("勤務地の「東京都渋谷区」から京都府を作らない", () => {
  assert.equal(extractLocation("勤務地：東京都渋谷区"), "東京都");
  assert.equal(extractLocation("勤務地：東京・大阪"), "東京都 | 大阪府");
});

// ── robots.txt ──

test("最長一致のAllowがDisallowに勝つ", () => {
  const { groups } = parseRobots("User-agent: *\nDisallow: /recruit/\nAllow: /recruit/jobs/");
  const pick = (url) => {
    const u = new URL(url);
    let best = null;
    for (const g of groups) {
      for (const r of g.rules) {
        const re = new RegExp(`^${r.pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}`);
        if (re.test(u.pathname) && (!best || r.pattern.length > best.pattern.length)) best = r;
      }
    }
    return best?.allow ?? true;
  };
  assert.equal(pick("https://example.com/recruit/"), false);
  assert.equal(pick("https://example.com/recruit/jobs/1"), true);
});

test("robots.txtのSitemap行を取り出す", () => {
  const { sitemaps } = parseRobots("Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow:");
  assert.deepEqual(sitemaps, ["https://example.com/sitemap.xml"]);
});

// ── sitemap / anchors / JSON-LD ──

test("sitemapindexを判別してlocを取り出す", () => {
  const xml = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://e.com/s1.xml</loc></sitemap></sitemapindex>';
  const got = parseSitemap(xml);
  assert.equal(got.isIndex, true);
  assert.deepEqual(got.locs, ["https://e.com/s1.xml"]);
});

test("相対リンクを絶対URLにしてアンカー文字を保持する", () => {
  const got = extractAnchors('<a href="/recruit/">採用情報</a><a href="mailto:a@b.c">mail</a>', "https://example.com/");
  assert.equal(got.length, 1);
  assert.equal(got[0].url, "https://example.com/recruit/");
  assert.equal(got[0].text, "採用情報");
});

test("JobPosting JSON-LDから構造化値を取り出す", () => {
  const block = JSON.stringify({
    "@type": "JobPosting",
    title: "バックエンドエンジニア",
    employmentType: "FULL_TIME",
    baseSalary: { "@type": "MonetaryAmount", currency: "JPY", value: { minValue: 4000000, maxValue: 7000000, unitText: "YEAR" } },
    jobLocation: { "@type": "Place", address: { addressRegion: "東京都", addressLocality: "港区" } },
  });
  const { hasJobPosting, postings } = extractJobPostings([block]);
  assert.equal(hasJobPosting, true);
  assert.equal(postings[0].title, "バックエンドエンジニア");
  assert.equal(postings[0].salaryMin, 4000000);
  assert.equal(postings[0].salaryMax, 7000000);
  assert.equal(postings[0].salaryUnit, "YEAR");
  assert.equal(postings[0].jobLocation, "東京都 港区");
});

test("JobPostingが無いJSON-LDはfalseを返す", () => {
  const { hasJobPosting, postings } = extractJobPostings([JSON.stringify({ "@type": "Organization", name: "X" })]);
  assert.equal(hasJobPosting, false);
  assert.equal(postings.length, 0);
});
