import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomerId,
  buildGenerateKeywordIdeasRequest,
  compactKeywordIdeas,
} from "./generate-keyword-demand.mjs";

test("normalizeCustomerId removes hyphens and non-digits", () => {
  assert.equal(normalizeCustomerId("123-456-7890"), "1234567890");
});

test("buildGenerateKeywordIdeasRequest targets Japan/Japanese Google Search", () => {
  const body = buildGenerateKeywordIdeasRequest({
    keywords: ["第二新卒 転職", "第二新卒 転職", "未経験 IT 転職"],
  });
  assert.deepEqual(body.language, "languageConstants/1005");
  assert.deepEqual(body.geoTargetConstants, ["geoTargetConstants/2392"]);
  assert.equal(body.keywordPlanNetwork, "GOOGLE_SEARCH");
  assert.deepEqual(body.keywordSeed.keywords, ["第二新卒 転職", "未経験 IT 転職"]);
});

test("compactKeywordIdeas normalizes, sorts and deduplicates results", () => {
  const rows = [
    {
      text: "第二新卒 転職",
      keywordIdeaMetrics: { avgMonthlySearches: "1000", competition: "MEDIUM" },
    },
    {
      text: "未経験 IT 転職",
      keywordIdeaMetrics: { avgMonthlySearches: 5000, competition: "HIGH" },
    },
    {
      text: "第二新卒 転職",
      keywordIdeaMetrics: { avgMonthlySearches: 900, competition: "LOW" },
    },
  ];
  const out = compactKeywordIdeas(rows, 10);
  assert.equal(out.length, 2);
  assert.equal(out[0].keyword, "未経験 IT 転職");
  assert.equal(out[0].avgMonthlySearches, 5000);
  assert.equal(out[1].avgMonthlySearches, 1000);
});
