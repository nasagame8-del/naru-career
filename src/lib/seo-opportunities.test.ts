import { describe, expect, it } from "vitest";
import type { SCPeriodData, SCRow } from "../types/search-console";
import { buildDecayingPages, buildQuickWins } from "./seo-opportunities";

function row(
  page: string,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number
): SCRow {
  return { keys: [page], clicks, impressions, ctr, position };
}

function period(topPages: SCRow[]): SCPeriodData {
  return {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    topQueries: [],
    topPages,
    pageQueries: [],
  };
}

describe("buildQuickWins", () => {
  it("picks low-volume NARU opportunities at positions 5-15", () => {
    const result = buildQuickWins(
      period([
        row("https://naru-career.com/articles/a", 0, 10, 0, 9.3),
        row("https://naru-career.com/articles/b", 1, 8, 0.125, 8),
        row("https://naru-career.com/articles/c", 0, 4, 0, 7),
        row("https://naru-career.com/articles/d", 0, 20, 0, 18),
      ])
    );

    expect(result.map((p) => p.keys[0])).toEqual([
      "https://naru-career.com/articles/a",
    ]);
    expect(result[0].priority).toBe("high");
    expect(result[0].signal).toBe("zero_clicks");
  });
});

describe("buildDecayingPages", () => {
  it("finds material impression and ranking declines", () => {
    const previous = period([
      row("https://naru-career.com/articles/a", 3, 30, 0.1, 6),
      row("https://naru-career.com/articles/b", 1, 10, 0.1, 8),
    ]);
    const current = period([
      row("https://naru-career.com/articles/a", 1, 12, 0.083, 7),
      row("https://naru-career.com/articles/b", 0, 9, 0, 14),
    ]);

    const result = buildDecayingPages(current, previous);
    expect(result).toHaveLength(2);
    expect(result[0].page).toBe("https://naru-career.com/articles/a");
    expect(result[0].priority).toBe("high");
    expect(result[1].positionChange).toBe(6);
  });
});
