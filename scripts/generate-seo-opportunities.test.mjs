import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregatePageQueryRows,
  buildSeoOpportunities,
  slugFromPage,
} from "./generate-seo-opportunities.mjs";

test("slugFromPage normalizes absolute/relative URLs, query strings and fragments", () => {
  assert.equal(slugFromPage("https://naru-career.com/articles/foo-bar"), "foo-bar");
  assert.equal(slugFromPage("/articles/foo-bar/"), "foo-bar");
  assert.equal(slugFromPage("/articles/foo-bar#section-0"), "foo-bar");
  assert.equal(slugFromPage("https://naru-career.com/articles/foo-bar/?ref=x#section-1"), "foo-bar");
  assert.equal(slugFromPage("/category/foo"), null);
});

test("aggregatePageQueryRows collapses URL variants and recomputes weighted metrics", () => {
  const known = new Set(["alpha"]);
  const rows = [
    { keys: ["/articles/alpha#section-0", "query"], clicks: 1, impressions: 100, ctr: 0.01, position: 4 },
    { keys: ["https://naru-career.com/articles/alpha/?x=1", "query",], clicks: 2, impressions: 50, ctr: 0.04, position: 10 },
  ];
  const result = aggregatePageQueryRows(rows, known);
  assert.equal(result.length, 1);
  assert.equal(result[0].clicks, 3);
  assert.equal(result[0].impressions, 150);
  assert.equal(result[0].ctr, 0.02);
  assert.equal(result[0].position, 6);
});

test("buildSeoOpportunities classifies unique slug × query rows without exposing metrics", () => {
  const known = new Set(["alpha", "beta", "gamma"]);
  const rows = [
    { keys: ["/articles/alpha#section-0", "第二新卒 it"], clicks: 1, impressions: 60, ctr: 0.01, position: 14 },
    { keys: ["/articles/alpha#section-1", "第二新卒 it"], clicks: 0, impressions: 40, ctr: 0, position: 14 },
    { keys: ["https://naru-career.com/articles/beta", "面接 対策"], clicks: 1, impressions: 80, ctr: 0.0125, position: 5 },
    { keys: ["/articles/alpha", "共通クエリ"], clicks: 0, impressions: 40, ctr: 0, position: 18 },
    { keys: ["/articles/gamma", "共通クエリ"], clicks: 1, impressions: 30, ctr: 0.033, position: 9 },
    { keys: ["/articles/unknown", "除外"], clicks: 0, impressions: 99, ctr: 0, position: 12 },
  ];

  const result = buildSeoOpportunities(rows, known);
  assert.equal(result.strikingDistance.filter((x) => x.slug === "alpha" && x.query === "第二新卒 it").length, 1);
  assert.ok(result.lowCtr.some((x) => x.slug === "beta"));
  assert.deepEqual(result.cannibalization[0].slugs, ["alpha", "gamma"]);
  assert.ok(result.prioritySlugs.includes("alpha"));

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('"impressions"'), false);
  assert.equal(serialized.includes('"clicks"'), false);
  assert.equal(serialized.includes('"ctr"'), false);
  assert.equal(serialized.includes('"position"'), false);
});
