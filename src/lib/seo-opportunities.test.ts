import { describe, expect, it } from "vitest";
import type { SCPeriodData, SCRow } from "../types/search-console";
import { buildDecayingPages, buildQuickWins } from "./seo-opportunities";

function row(
  page: string,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number,
  query?: string
): SCRow {
  return { keys: query ? [page, query] : [page], clicks, impressions, ctr, position };
}

function period(topPages: SCRow[], pageQueries: SCRow[] = []): SCPeriodData {
  return {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    topQueries: [],
    topPages,
    pageQueries,
  };
}

describe("buildQuickWins", () => {
  it("picks low-volume NARU opportunities at positions 5-15", () => {
    const result = buildQuickWins(
      period(
        [
          // ページ全体ではCTRが2%を超えていても、特定クエリだけ取りこぼすケースを再現
          row("https://naru-career.com/articles/a", 5, 156, 0.032, 8.4),
        ],
        [
          row("https://naru-career.com/articles/a", 0, 10, 0, 9.3, "正社員 から業務委託 クビ"),
          row("https://naru-career.com/articles/b", 1, 8, 0.125, 8, "クリック済み"),
          row("https://naru-career.com/articles/c", 0, 4, 0, 7, "表示不足"),
          row("https://naru-career.com/articles/d", 0, 20, 0, 18, "順位圏外"),
        ]
      )
    );

    expect(result).toHaveLength(1);
    expect(result[0].page).toBe("https://naru-career.com/articles/a");
    expect(result[0].query).toBe("正社員 から業務委託 クビ");
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
