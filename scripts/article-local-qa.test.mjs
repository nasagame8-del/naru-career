import test from "node:test";
import assert from "node:assert/strict";

import {
  parseArgs,
  isValidSlug,
  extractImageRefs,
  extractInternalLinks,
  runLocalQa,
} from "./article-local-qa.mjs";

// ── 引数 ──

test("parseArgs は --slug と --slug= の両形式を読む", () => {
  assert.equal(parseArgs(["--slug", "my-article"]).slug, "my-article");
  assert.equal(parseArgs(["--slug=my-article"]).slug, "my-article");
});

test("parseArgs は --skip-heavy を読む", () => {
  assert.equal(parseArgs(["--slug", "a", "--skip-heavy"]).skipHeavy, true);
  assert.equal(parseArgs(["--slug", "a"]).skipHeavy, false);
});

test("parseArgs は slug 未指定を null で返す", () => {
  assert.equal(parseArgs([]).slug, null);
});

// ── slug ──

test("isValidSlug は正しいslugのみ通す", () => {
  assert.equal(isValidSlug("second-new-grad-web-marketing-career"), true);
  assert.equal(isValidSlug("abc123"), true);
  assert.equal(isValidSlug("My_Slug"), false);
  assert.equal(isValidSlug("-leading"), false);
  assert.equal(isValidSlug("trailing-"), false);
  assert.equal(isValidSlug("日本語"), false);
  assert.equal(isValidSlug("../etc/passwd"), false);
  assert.equal(isValidSlug(null), false);
});

// ── 画像参照の抽出 ──

test("extractImageRefs は alt と src を取り出す", () => {
  const refs = extractImageRefs(
    "文章\n![説明文](/images/articles/a-01.webp)\nさらに![](/images/articles/a-02.webp)"
  );
  assert.equal(refs.length, 2);
  assert.deepEqual(refs[0], { alt: "説明文", src: "/images/articles/a-01.webp" });
  assert.equal(refs[1].alt, "");
});

test("extractImageRefs は通常リンクを画像として拾わない", () => {
  const refs = extractImageRefs("[適職診断](/shindan)");
  assert.equal(refs.length, 0);
});

// ── 内部リンクの抽出 ──

test("extractInternalLinks はサイト内パスのみ返す", () => {
  const links = extractInternalLinks(
    "[A](/shindan) [B](https://example.com) [C](/articles/foo)"
  );
  assert.deepEqual(links.sort(), ["/articles/foo", "/shindan"]);
});

test("extractInternalLinks は画像参照を内部リンクに数えない", () => {
  const links = extractInternalLinks("![alt](/images/articles/a-01.webp)");
  assert.deepEqual(links, []);
});

test("extractInternalLinks はクエリ・フラグメントを落として重複を畳む", () => {
  const links = extractInternalLinks("[A](/shindan?x=1) [B](/shindan#top)");
  assert.deepEqual(links, ["/shindan"]);
});

// ── 実リポジトリに対する検証（重い工程はスキップ） ──

test("存在しないslugでは記事・画像チェックがFAILし失敗扱いになる", async () => {
  const report = await runLocalQa({
    slug: "this-slug-does-not-exist-xyz",
    skipHeavy: true,
  });
  assert.equal(report.failed, true);
  const md = report.rows.find((r) => r.step === 1);
  assert.equal(md.ok, false);
  const images = report.rows.find((r) => r.step === 2);
  assert.equal(images.ok, false);
});

test("画像4枚が揃った実記事は画像系チェックがすべてPASSする", async () => {
  // master に実在し、card/01/02/03 の4枚が揃っているslug
  const report = await runLocalQa({
    slug: "second-new-grad-web-marketing-career",
    skipHeavy: true,
  });

  for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const row = report.rows.find((r) => r.step === step);
    assert.ok(row, `step ${step} の結果がありません`);
    assert.equal(row.ok, true, `step ${step} (${row.name}) が FAIL: ${row.detail}`);
  }
});

test("--skip-heavy では test/tsc/build を実行せずスキップ扱いにする", async () => {
  const report = await runLocalQa({
    slug: "second-new-grad-web-marketing-career",
    skipHeavy: true,
  });
  for (const step of [10, 11, 12]) {
    const row = report.rows.find((r) => r.step === step);
    assert.match(row.detail, /スキップ/);
    assert.equal(row.ok, true);
  }
});

test("レポートは全14項目相当の行を持ち、失敗有無を判定できる", async () => {
  const report = await runLocalQa({
    slug: "second-new-grad-it-interview-questions",
    skipHeavy: true,
  });
  // 1〜12 の主要ステップが揃っている
  const steps = report.rows.map((r) => r.step).filter((s) => Number.isInteger(s));
  for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    assert.ok(steps.includes(step), `step ${step} が欠けています`);
  }
  assert.equal(report.failed, false);
});
