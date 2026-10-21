import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSalary,
  extractExperienceYears,
  extractEmploymentType,
  extractLocation,
  extractRequirementExcerpt,
  stripCompanyName,
  normaliseTitleKey,
  classifyTitle,
  titleConfidence,
  fieldScore,
  roleFromRows,
  rolesFromRowLabels,
  extractCandidatesFromPage,
  jobLinkCandidates,
  dedupKey,
  assignDuplicateGroups,
  isAnalysisRecord,
} from "./research-jobs.mjs";
import {
  matchFlags,
  parseRobots,
  parseSitemap,
  extractAnchors,
  extractJobPostings,
  extractBlocks,
  headingSections,
  rowsWithin,
} from "./research-web.mjs";

const REQUIRED_LABELS = ["必須スキル", "必須条件", "応募資格"];
const PREFERRED_LABELS = ["歓迎スキル", "歓迎条件", "あると望ましい"];

const doc = (url = "https://example.co.jp/recruit/") => ({
  finalUrl: url,
  httpStatus: 200,
  robotsStatus: "allowed",
  fetchedAt: "2026-10-04T00:00:00.000Z",
});

const extract = (html, opts = {}) =>
  extractCandidatesFromPage({
    html,
    doc: doc(opts.url),
    company: opts.company ?? "株式会社サンプル",
    corporateNumber: "1234567890123",
    isIndexPage: opts.isIndexPage ?? false,
  }).candidates;

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
});

test("月給は月額として保持し、年額に換算しない", () => {
  const r = extractSalary("月給 250,000円 〜 400,000円");
  assert.equal(r.salaryMin, 250_000);
  assert.equal(r.salaryUnit, "MONTH");
});

test("全角数字の月給も読める", () => {
  const r = extractSalary("月給２２万円〜３５万円");
  assert.equal(r.salaryMin, 220_000);
  assert.equal(r.salaryMax, 350_000);
});

test("給与の記載がなければ全てnull（0にしない）", () => {
  assert.deepEqual(extractSalary("当社規定により優遇します"), {
    salaryMin: null, salaryMax: null, salaryUnit: null, salarySource: null,
  });
});

// ── 経験年数・雇用形態・勤務地 ──

test("「実務経験3年以上」から3を取る", () => {
  assert.equal(extractExperienceYears("Javaでの実務経験3年以上"), 3);
});

test("経験不問は年数不明なのでnull（0と書かない）", () => {
  assert.equal(extractExperienceYears("未経験・経験不問"), null);
});

test("雇用形態は記載された語だけを返す", () => {
  assert.equal(extractEmploymentType("雇用形態：正社員"), "正社員");
  assert.equal(extractEmploymentType("特に記載なし"), null);
});

test("勤務地の「東京都渋谷区」から京都府を作らない", () => {
  assert.equal(extractLocation("勤務地：東京都渋谷区"), "東京都");
  assert.equal(extractLocation("勤務地：東京・大阪"), "東京都 | 大阪府");
  assert.equal(extractLocation("勤務地：京都市中京区"), "京都府");
});

test("勤務地ラベルが無ければnull", () => {
  assert.equal(extractLocation("弊社は東京で創業しました"), null);
});

// ── 応募資格の抜粋 ──

test("応募資格の抜粋は次の見出しで打ち切る", () => {
  const got = extractRequirementExcerpt("応募資格：Javaでの開発経験 給与：年収400万円〜", REQUIRED_LABELS);
  assert.ok(got.startsWith("応募資格: Javaでの開発経験"));
  assert.ok(!got.includes("400万円"));
});

test("抜粋は勤務先でも打ち切る", () => {
  const got = extractRequirementExcerpt("応募資格：開発経験3年以上 勤務先 【本社】横浜市西区", REQUIRED_LABELS);
  assert.ok(!got.includes("横浜市西区"));
});

test("「歓迎します」のような本文中の語は歓迎スキルにしない", () => {
  assert.equal(extractRequirementExcerpt("経験者を歓迎します。お問い合わせください", PREFERRED_LABELS), null);
});

// ── タイトル分類 ──

test("コンテナ見出しはcontainerに分類される", () => {
  for (const t of ["Recruit", "採用情報", "採用案内", "採用について", "募集要項", "募集職種", "職種一覧", "求人情報", "ENTRY", "JOB", "JOBS", "CAREER"]) {
    assert.equal(classifyTitle(t), "container", `${t} should be container`);
  }
});

test("Recruit 採用情報 のような結合見出しもcontainer", () => {
  assert.equal(classifyTitle("Recruit 採用情報"), "container");
  assert.equal(classifyTitle("採用情報 RECRUIT"), "container");
});

test("募集区分はcategoryに分類される", () => {
  for (const t of ["新卒採用", "中途採用", "キャリア採用", "経験者採用"]) {
    assert.equal(classifyTitle(t), "category", `${t} should be category`);
  }
});

test("職種名はroleに分類される", () => {
  for (const t of ["システムエンジニア", "Webディレクター", "営業", "インフラエンジニア", "技術職"]) {
    assert.equal(classifyTitle(t), "role", `${t} should be role`);
  }
});

test("募集区分＋職種の結合見出しはroleとして扱う", () => {
  assert.equal(classifyTitle("新卒採用（技術職コース）"), "role");
});

test("募集区分＋ページ用語はcategoryのまま", () => {
  assert.equal(classifyTitle("新卒採用 エントリー"), "category");
  assert.equal(classifyTitle("中途採用情報"), "category");
});

test("キャッチコピーの文は職種名にしない", () => {
  assert.equal(classifyTitle("エンジニアの「将来像」実現に、本気になる。それが成長の理由です。"), "other");
});

test("社員プロフィールは職種名にしない", () => {
  assert.equal(classifyTitle("総務部経理課：経理（2022年入社） M.I"), "other");
  assert.equal(classifyTitle("I.S 営業"), "other");
});

test("条件行のラベルは職種にしない", () => {
  const rows = [
    { label: "人事制度", value: "各種制度があります" },
    { label: "給与体系", value: "月給制" },
    { label: "営業", value: "IT営業・技術営業を担当します" },
  ];
  const got = rolesFromRowLabels(rows);
  assert.deepEqual(got.map((g) => g.title), ["営業"]);
});

test("勤務地の値が表の続きを飲み込まない", () => {
  const got = extractLocation("勤務地 札幌市 ※業務内容により出張あり 就業時間 9:00～18:00 休日 土日祝 賃金 月給制");
  assert.ok(got.includes("札幌市"));
  assert.ok(!got.includes("就業時間"));
  assert.ok(!got.includes("月給制"));
});

test("タイトル正規化は全角・記号・空白を無視する", () => {
  assert.equal(normaliseTitleKey("【募集職種】 Ｗｅｂディレクター"), normaliseTitleKey("募集職種webディレクター"));
});

test("会社名をタイトルから除去する", () => {
  assert.equal(stripCompanyName("Webエンジニア | 株式会社ニックス", "株式会社ニックス"), "Webエンジニア");
  assert.equal(stripCompanyName("募集要項｜システムエンジニア", "株式会社サンプル"), "システムエンジニア");
});

// ── confidence ──

test("JSON-LDのtitleは常にhigh", () => {
  assert.equal(titleConfidence({ evidence: "jsonld.title", titleClass: "role", fields: 0 }), "high");
});

test("containerとcategoryはlowになり本集計から外れる", () => {
  assert.equal(titleConfidence({ evidence: "detail.h1", titleClass: "container", fields: 5 }), "low");
  assert.equal(titleConfidence({ evidence: "detail.h1", titleClass: "category", fields: 5 }), "low");
});

test("職種名＋項目2つ以上でhigh、1つでmedium", () => {
  assert.equal(titleConfidence({ evidence: "section.heading", titleClass: "role", fields: 2 }), "high");
  assert.equal(titleConfidence({ evidence: "section.heading", titleClass: "role", fields: 1 }), "medium");
});

// ── ページ分解 ──

test("1ページに2職種あれば2レコードに分解する", () => {
  const html = `
    <html><body>
      <h1>Recruit 採用情報</h1>
      <h2>システムエンジニア</h2>
      <p>仕事内容：業務システムの開発</p><p>勤務地：東京都千代田区</p><p>給与：月給25万円〜</p>
      <h2>営業</h2>
      <p>仕事内容：法人向け提案営業</p><p>勤務地：大阪府大阪市</p><p>雇用形態：正社員</p>
    </body></html>`;
  const recs = extract(html).filter(isAnalysisRecord);
  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map((r) => r.jobTitle).sort(), ["システムエンジニア", "営業"]);
  assert.ok(recs.every((r) => r.recordType === "job_section"));
});

test("「中途採用／募集要項」だけなら求人レコードにしない", () => {
  const html = `<html><body><h1>中途採用</h1><h2>募集要項</h2><p>お問い合わせください</p></body></html>`;
  const all = extract(html);
  assert.equal(all.filter(isAnalysisRecord).length, 0);
  assert.ok(all.every((r) => ["category", "container", "unknown"].includes(r.recordType)));
});

test("「Recruit 採用情報」が求人タイトルとして採用されない（既知の誤検出）", () => {
  const html = `
    <html><head><title>株式会社サンプル 採用サイト</title></head><body>
      <h1>Recruit 採用情報</h1>
      <p>仕事内容：各種開発</p><p>給与：当社規定</p><p>勤務地：東京都</p>
    </body></html>`;
  const all = extract(html);
  assert.equal(all.filter(isAnalysisRecord).length, 0);
  assert.ok(!all.some((r) => isAnalysisRecord(r) && /Recruit|採用情報/i.test(r.jobTitle ?? "")));
  assert.equal(all[0].recordType, "container");
});

test("募集要項テーブルの職種セルから求人を作る", () => {
  const html = `
    <html><body><h1>採用情報</h1>
      <table>
        <tr><th>職種</th><td>インフラエンジニア</td></tr>
        <tr><th>雇用形態</th><td>正社員</td></tr>
        <tr><th>勤務地</th><td>東京都港区</td></tr>
        <tr><th>給与</th><td>年収400万円〜700万円</td></tr>
      </table>
    </body></html>`;
  const recs = extract(html).filter(isAnalysisRecord);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].jobTitle, "インフラエンジニア");
  assert.equal(recs[0].jobTitleEvidence, "field:職種");
  assert.equal(recs[0].salaryMin, 4_000_000);
  assert.equal(recs[0].location, "東京都");
});

test("dl/dt/ddの職種定義リストからも求人を作る", () => {
  const html = `
    <html><body><h2>募集要項</h2>
      <dl>
        <dt>募集職種</dt><dd>Webディレクター</dd>
        <dt>仕事内容</dt><dd>進行管理</dd>
        <dt>勤務地</dt><dd>福岡県福岡市</dd>
      </dl>
    </body></html>`;
  const recs = extract(html).filter(isAnalysisRecord);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].jobTitle, "Webディレクター");
  assert.equal(recs[0].location, "福岡県");
});

test("1職種の求人詳細ページはjob_detailになる", () => {
  const html = `
    <html><head><title>バックエンドエンジニア｜株式会社サンプル</title></head><body>
      <h1>バックエンドエンジニア</h1>
      <p>業務内容：APIの設計開発</p><p>雇用形態：正社員</p><p>応募資格：実務経験2年以上</p>
    </body></html>`;
  const recs = extract(html, { url: "https://example.co.jp/recruit/backend/" }).filter(isAnalysisRecord);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].recordType, "job_detail");
  assert.equal(recs[0].jobTitle, "バックエンドエンジニア");
  assert.equal(recs[0].experienceYearsMin, 2);
});

test("募集区分の下に職種がある場合は職種を抽出する", () => {
  const html = `
    <html><body>
      <h1>採用情報</h1>
      <h2>新卒採用</h2>
      <h3>技術職（システムエンジニア）</h3>
      <p>仕事内容：システム開発</p><p>勤務地：愛知県名古屋市</p>
      <h2>中途採用</h2>
      <h3>営業職</h3>
      <p>仕事内容：既存顧客のフォロー</p><p>雇用形態：正社員</p>
    </body></html>`;
  const recs = extract(html).filter(isAnalysisRecord);
  assert.equal(recs.length, 2);
  assert.ok(recs.some((r) => /システムエンジニア/.test(r.jobTitle)));
  assert.ok(recs.some((r) => /営業/.test(r.jobTitle)));
});

test("JobPosting JSON-LDがあれば最優先で使う", () => {
  const html = `
    <html><body>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "JobPosting",
        title: "フロントエンドエンジニア",
        employmentType: "FULL_TIME",
        baseSalary: { "@type": "MonetaryAmount", currency: "JPY", value: { minValue: 5000000, maxValue: 8000000, unitText: "YEAR" } },
        jobLocation: { "@type": "Place", address: { addressRegion: "東京都", addressLocality: "新宿区" } },
      })}</script>
      <h1>Recruit 採用情報</h1>
    </body></html>`;
  const recs = extract(html).filter(isAnalysisRecord);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].jobTitle, "フロントエンドエンジニア");
  assert.equal(recs[0].jobTitleEvidence, "jsonld.title");
  assert.equal(recs[0].jobTitleConfidence, "high");
  assert.equal(recs[0].salaryMin, 5_000_000);
});

test("職種名のない採用トップはunknown/containerとして保持される", () => {
  const html = `<html><body><h1>私たちについて</h1><p>会社紹介です</p></body></html>`;
  const all = extract(html);
  assert.equal(all.filter(isAnalysisRecord).length, 0);
  assert.equal(all.length, 1);
});

test("求人カードは一覧ページでのみ生成し、項目が無ければ作らない", () => {
  const html = `
    <html><body><h1>募集職種</h1>
      <ul>
        <li><a href="/recruit/se/">システムエンジニア</a> 給与：月給23万円〜 勤務地：東京都</li>
        <li><a href="/about/">会社概要</a></li>
      </ul>
    </body></html>`;
  const cards = extract(html, { isIndexPage: true }).filter((r) => r.recordType === "job_card");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].jobTitle, "システムエンジニア");
  assert.equal(cards[0].jobUrl, "https://example.co.jp/recruit/se/");
});

// ── セクション分割の土台 ──

test("見出しセクションは同レベル以上の見出しで区切られる", () => {
  const blocks = extractBlocks("<h2>A</h2><p>aaa</p><h3>A-1</h3><p>bbb</p><h2>B</h2><p>ccc</p>");
  const sections = headingSections(blocks);
  const a = sections.find((s) => s.heading === "A");
  assert.ok(a.text.includes("aaa"));
  assert.ok(a.text.includes("bbb"));
  assert.ok(!a.text.includes("ccc"));
});

test("scriptの中身はセクション本文に混ざらない", () => {
  const blocks = extractBlocks('<h2>システムエンジニア</h2><script>var x="勤務地：北海道";</script><p>仕事内容：開発</p>');
  const s = headingSections(blocks)[0];
  assert.ok(s.text.includes("仕事内容"));
  assert.ok(!s.text.includes("北海道"));
});

test("テーブル行はセクション範囲で絞り込める", () => {
  const blocks = extractBlocks("<h2>A</h2><table><tr><th>職種</th><td>営業</td></tr></table><h2>B</h2><table><tr><th>職種</th><td>経理</td></tr></table>");
  const sections = headingSections(blocks);
  const a = sections.find((s) => s.heading === "A");
  assert.equal(roleFromRows(rowsWithin(blocks, a.start, a.end)), "営業");
});

test("fieldScoreは求人項目の数を数える", () => {
  assert.equal(fieldScore("会社の紹介文です"), 0);
  assert.ok(fieldScore("仕事内容：開発 給与：月給20万円 勤務地：東京都 雇用形態：正社員") >= 4);
});

// ── リンク探索 ──

test("職種名アンカーと募集要項アンカーを区別する", () => {
  const anchors = [
    { url: "https://example.co.jp/recruit/jobs/", text: "募集職種" },
    { url: "https://example.co.jp/recruit/se/", text: "システムエンジニア" },
    { url: "https://example.co.jp/company/", text: "会社概要" },
    { url: "https://jp.indeed.com/cmp/x", text: "エンジニア" },
  ];
  const got = jobLinkCandidates(anchors, "https://example.co.jp/recruit/", "https://example.co.jp/");
  assert.deepEqual(got.indexes.map((i) => i.url), ["https://example.co.jp/recruit/jobs/"]);
  assert.deepEqual(got.details.map((d) => d.url), ["https://example.co.jp/recruit/se/"]);
});

test("第三者求人媒体とインタビューページは辿らない", () => {
  const anchors = [
    { url: "https://www.wantedly.com/companies/x", text: "エンジニア" },
    { url: "https://example.co.jp/recruit/interview/01/", text: "エンジニア" },
  ];
  const got = jobLinkCandidates(anchors, "https://example.co.jp/recruit/", "https://example.co.jp/");
  assert.equal(got.details.length, 0);
});

// ── 重複 ──

test("同一求人は同じduplicateGroupIdになり、統合はされない", () => {
  const records = [
    { corporateNumber: "1", normalizedJobTitle: "システムエンジニア", employmentType: "正社員", location: "東京都", jobUrl: "https://a/1" },
    { corporateNumber: "1", normalizedJobTitle: "システムエンジニア", employmentType: "正社員", location: "東京都", jobUrl: "https://a/2" },
    { corporateNumber: "1", normalizedJobTitle: "営業", employmentType: "正社員", location: "東京都", jobUrl: "https://a/3" },
  ];
  assignDuplicateGroups(records);
  assert.equal(records[0].duplicateGroupId, records[1].duplicateGroupId);
  assert.notEqual(records[0].duplicateGroupId, records[2].duplicateGroupId);
  assert.equal(records[0].isDuplicateOfEarlierRecord, false);
  assert.equal(records[1].isDuplicateOfEarlierRecord, true);
  assert.equal(records.length, 3);
});

test("重複キーは会社・職種・雇用形態・勤務地で作られる", () => {
  const key = dedupKey({ corporateNumber: "1", normalizedJobTitle: "a", employmentType: "正社員", location: "東京都" });
  assert.equal(key.split("|").length, 4);
});

// ── 集計対象の判定 ──

test("集計対象はjob系かつhigh/mediumのみ", () => {
  assert.equal(isAnalysisRecord({ recordType: "job_detail", jobTitleConfidence: "high", jobTitle: "a" }), true);
  assert.equal(isAnalysisRecord({ recordType: "job_section", jobTitleConfidence: "medium", jobTitle: "a" }), true);
  assert.equal(isAnalysisRecord({ recordType: "job_detail", jobTitleConfidence: "low", jobTitle: "a" }), false);
  assert.equal(isAnalysisRecord({ recordType: "category", jobTitleConfidence: "high", jobTitle: "a" }), false);
  assert.equal(isAnalysisRecord({ recordType: "container", jobTitleConfidence: "high", jobTitle: "a" }), false);
  assert.equal(isAnalysisRecord({ recordType: "unknown", jobTitleConfidence: "high", jobTitle: "a" }), false);
  assert.equal(isAnalysisRecord({ recordType: "job_detail", jobTitleConfidence: "high", jobTitle: null }), false);
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

// ── robots / sitemap / JSON-LD ──

test("robots.txtのSitemap行を取り出す", () => {
  const { sitemaps } = parseRobots("Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow:");
  assert.deepEqual(sitemaps, ["https://example.com/sitemap.xml"]);
});

test("sitemapindexを判別してlocを取り出す", () => {
  const got = parseSitemap('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://e.com/s1.xml</loc></sitemap></sitemapindex>');
  assert.equal(got.isIndex, true);
  assert.deepEqual(got.locs, ["https://e.com/s1.xml"]);
});

test("相対リンクを絶対URLにしてアンカー文字を保持する", () => {
  const got = extractAnchors('<a href="/recruit/">採用情報</a><a href="mailto:a@b.c">mail</a>', "https://example.com/");
  assert.equal(got.length, 1);
  assert.equal(got[0].url, "https://example.com/recruit/");
  assert.equal(got[0].text, "採用情報");
});

test("JobPostingが無いJSON-LDはfalseを返す", () => {
  const { hasJobPosting, postings } = extractJobPostings([JSON.stringify({ "@type": "Organization", name: "X" })]);
  assert.equal(hasJobPosting, false);
  assert.equal(postings.length, 0);
});
