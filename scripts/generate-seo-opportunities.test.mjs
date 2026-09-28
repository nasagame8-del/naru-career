import test from "node:test";
import assert from "node:assert/strict";
import { buildSeoOpportunities, slugFromPage } from "./generate-seo-opportunities.mjs";

test("slugFromPage extracts article slug", () => {
  assert.equal(slugFromPage("https://naru-career.com/articles/foo-bar"), "foo-bar");
  assert.equal(slugFromPage("/articles/foo-bar/"), "foo-bar");
  assert.equal(slugFromPage("/category/foo"), null);
});

test("buildSeoOpportunities classifies opportunities without exposing metrics", () => {
  const known = new Set(["alpha", "beta", "gamma"]);
  const rows = [
    { keys: ["https://naru-career.com/articles/alpha", "第二新卒 it"], clicks: 1, impressions: 100, ctr: 0.01, position: 14 },
    { keys: ["https://naru-career.com/articles/beta", "面接 対策"], clicks: 1, impressions: 80, ctr: 0.0125, position: 5 },
    { keys: ["https://naru-career.com/articles/alpha", "共通クエリ"], clicks: 0, impressions: 40, ctr: 0, position: 18 },
    { keys: ["https://naru-career.com/articles/gamma", "共通クエリ"], clicks: 1, impressions: 30, ctr: 0.033, position: 9 },
    { keys: ["https://naru-career.com/articles/unknown", "除外"], clicks: 0, impressions: 99, ctr: 0, position: 12 },
  ];

  const result = buildSeoOpportunities(rows, known);
  assert.equal(result.strikingDistance[0].slug, "alpha");
  assert.ok(result.lowCtr.some((x) => x.slug === "beta"));
  assert.deepEqual(result.cannibalization[0].slugs, ["alpha", "gamma"]);
  assert.ok(result.prioritySlugs.includes("alpha"));

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('"impressions"'), false);
  assert.equal(serialized.includes('"clicks"'), false);
  assert.equal(serialized.includes('"ctr"'), false);
  assert.equal(serialized.includes('"position"'), false);
});
