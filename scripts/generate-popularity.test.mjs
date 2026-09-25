import test from "node:test";
import assert from "node:assert/strict";

import { buildOrder, slugFromPage } from "./generate-popularity.mjs";

// ── URL → slug ──

test("slugFromPage は記事URLからslugを取り出す", () => {
  assert.equal(
    slugFromPage("https://naru-career.com/articles/second-new-grad-it-career-change"),
    "second-new-grad-it-career-change"
  );
  assert.equal(slugFromPage("/articles/my-slug"), "my-slug");
  assert.equal(slugFromPage("https://naru-career.com/articles/my-slug/"), "my-slug");
});

test("slugFromPage は記事以外のページを null にする", () => {
  assert.equal(slugFromPage("https://naru-career.com/"), null);
  assert.equal(slugFromPage("https://naru-career.com/shindan"), null);
  assert.equal(slugFromPage("https://naru-career.com/category/taiken"), null);
  assert.equal(slugFromPage("https://naru-career.com/articles/"), null);
});

test("slugFromPage は不正な入力を null にする", () => {
  assert.equal(slugFromPage("not a url"), null);
  assert.equal(slugFromPage(""), null);
});

test("slugFromPage は不正な形式のslugを弾く", () => {
  assert.equal(slugFromPage("/articles/Bad_Slug"), null);
  assert.equal(slugFromPage("/articles/-leading"), null);
  assert.equal(slugFromPage("/articles/a/b"), null);
});

// ── 並び順の構成 ──

const KNOWN = new Set(["alpha", "beta", "gamma"]);

function row(page, clicks, impressions) {
  return { keys: [`https://naru-career.com/articles/${page}`], clicks, impressions };
}

test("buildOrder はクリック数の降順に並べる", () => {
  const order = buildOrder([row("alpha", 5, 100), row("beta", 20, 50), row("gamma", 10, 10)], KNOWN);
  assert.deepEqual(order, ["beta", "gamma", "alpha"]);
});

test("buildOrder はクリック同数なら表示回数の降順にする", () => {
  const order = buildOrder([row("alpha", 5, 10), row("beta", 5, 999)], KNOWN);
  assert.deepEqual(order, ["beta", "alpha"]);
});

test("buildOrder はクリック・表示ともに同数ならslug昇順で安定させる", () => {
  const order = buildOrder([row("gamma", 1, 1), row("alpha", 1, 1)], KNOWN);
  assert.deepEqual(order, ["alpha", "gamma"]);
});

test("buildOrder は記事以外のページを除外する", () => {
  const rows = [
    { keys: ["https://naru-career.com/"], clicks: 999, impressions: 999 },
    { keys: ["https://naru-career.com/shindan"], clicks: 500, impressions: 500 },
    row("alpha", 1, 1),
  ];
  assert.deepEqual(buildOrder(rows, KNOWN), ["alpha"]);
});

test("buildOrder は存在しない記事slugを除外する（削除済み記事）", () => {
  const rows = [row("deleted-article", 999, 999), row("alpha", 1, 1)];
  assert.deepEqual(buildOrder(rows, KNOWN), ["alpha"]);
});

test("buildOrder は同一slugの複数行を合算する", () => {
  const rows = [row("alpha", 3, 10), row("alpha", 4, 20), row("beta", 5, 1)];
  // alpha は 7 クリックで beta の 5 を上回る
  assert.deepEqual(buildOrder(rows, KNOWN), ["alpha", "beta"]);
});

test("buildOrder は行が無い場合に空配列を返す", () => {
  assert.deepEqual(buildOrder([], KNOWN), []);
  assert.deepEqual(buildOrder(undefined, KNOWN), []);
});

test("buildOrder は欠損した clicks / impressions を0として扱う", () => {
  const rows = [{ keys: ["/articles/alpha"] }, row("beta", 1, 1)];
  assert.deepEqual(buildOrder(rows, KNOWN), ["beta", "alpha"]);
});

test("buildOrder は keys が無い行を無視する", () => {
  const rows = [{ clicks: 999 }, row("alpha", 1, 1)];
  assert.deepEqual(buildOrder(rows, KNOWN), ["alpha"]);
});

// ── 出力に実数値を含めない方針 ──

test("buildOrder はslugの配列だけを返す（クリック数などを含めない）", () => {
  const order = buildOrder([row("alpha", 12345, 67890)], KNOWN);
  assert.deepEqual(order, ["alpha"]);
  for (const item of order) assert.equal(typeof item, "string");
  // 数値が混入していないこと
  assert.equal(JSON.stringify(order).includes("12345"), false);
  assert.equal(JSON.stringify(order).includes("67890"), false);
});
