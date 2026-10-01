import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  baselineWindow,
  checkpointWindow,
  summarizeRows,
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
