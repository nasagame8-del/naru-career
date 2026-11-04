import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  baselineWindow,
  checkpointWindow,
  summarizeRows,
  resolveAnchorDate,
} from "./measure-seo-experiments.mjs";

test("SEO experiment windows use comparable trailing seven-day periods", () => {
  assert.deepEqual(baselineWindow("2026-10-01"), {
    startDate: "2026-09-24",
    endDate: "2026-09-30",
  });
  assert.deepEqual(checkpointWindow("2026-10-01", 7), {
    startDate: "2026-10-02",
    endDate: "2026-10-08",
  });
  assert.deepEqual(checkpointWindow("2026-10-01", 14), {
    startDate: "2026-10-09",
    endDate: "2026-10-15",
  });
  assert.equal(addDays("2026-10-01", 28), "2026-10-29");
});

test("summarizeRows uses impression-weighted average position", () => {
  const summary = summarizeRows([
    { clicks: 1, impressions: 10, position: 5 },
    { clicks: 0, impressions: 30, position: 15 },
  ]);
  assert.equal(summary.clicks, 1);
  assert.equal(summary.impressions, 40);
  assert.equal(summary.ctr, 0.025);
  assert.equal(summary.position, 12.5);
});

test("SEO experiment uses the immutable intervention date despite later article edits", async () => {
  const run = {
    id: "quickwin-2026-10-02-business-outsourcing-conversion-risk",
    measurementPlan: { anchor: "article_dateModified", anchorDate: "2026-10-02" },
    actionDecision: { decisions: [{ targetType: "article", target: "business-outsourcing-conversion-risk", action: "REWRITE" }] },
  };
  assert.deepEqual(await resolveAnchorDate(run), {
    date: "2026-10-02",
    source: "measurement_plan_fixed",
  });
  assert.deepEqual(baselineWindow("2026-10-02"), {
    startDate: "2026-09-25",
    endDate: "2026-10-01",
  });
  assert.deepEqual(checkpointWindow("2026-10-02", 7), {
    startDate: "2026-10-03",
    endDate: "2026-10-09",
  });
});

test("SEO experiment refuses invalid configured dates instead of silently shifting the baseline", async () => {
  await assert.rejects(
    resolveAnchorDate({ id: "bad-date", measurementPlan: { anchorDate: "2026-02-30" } }),
    /Invalid measurementPlan anchor/
  );
});
