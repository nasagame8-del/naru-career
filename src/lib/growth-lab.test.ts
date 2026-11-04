import { describe, expect, it } from "vitest";
import {
  buildAioScores,
  buildDemandRadar,
  buildInternalLinkSuggestions,
  buildSeoExperiments,
} from "./growth-lab";
import type { SCData } from "@/types/search-console";

describe("growth lab", () => {
  it("prioritizes top10 zero-click queries", () => {
    const gsc: SCData = {
      configured: true,
      queryInsights: [
        {
          query: "正社員 から業務委託 クビ",
          clicks: 0,
          impressions: 13,
          ctr: 0,
          position: 9.4,
          pages: [{ page: "https://naru-career.com/articles/business-outsourcing-conversion-risk", clicks: 0, impressions: 13, position: 9.4 }],
          prevPosition: 14,
          positionChange: -4.6,
          prevImpressions: 4,
          impressionChange: 225,
          suggestion: null,
        },
      ],
    };
    const radar = buildDemandRadar(gsc);
    expect(radar[0].signal).toBe("top10_close");
    expect(radar[0].action).toContain("スニペット");
    expect(buildSeoExperiments(radar)[0].experimentType).toBe("title_snippet");
  });

  it("suggests a missing related internal link", () => {
    const items = buildInternalLinkSuggestions([
      {
        slug: "a",
        title: "正社員から業務委託へ切り替える",
        keyword: "正社員 業務委託",
        body: "業務委託へ切り替える前に契約解除と社会保険を確認します。",
        outgoing: [],
        faqCount: 1,
        summaryCount: 1,
        hasAuthoritativeSource: true,
        hasUpdateHistory: true,
        hasImage: true,
        hasComparisonTable: false,
      },
      {
        slug: "b",
        title: "業務委託の契約解除",
        keyword: "業務委託 契約解除",
        body: "契約解除の通知期間や途中解約を確認します。",
        outgoing: [],
        faqCount: 1,
        summaryCount: 1,
        hasAuthoritativeSource: true,
        hasUpdateHistory: true,
        hasImage: true,
        hasComparisonTable: false,
      },
    ]);
    expect(items.some((x) => x.sourceSlug === "a" && x.targetSlug === "b")).toBe(true);
  });

  it("scores strong AIO structure higher", () => {
    const scores = buildAioScores([
      {
        slug: "strong",
        title: "強い記事",
        keyword: "テスト",
        body: "結論：まず確認します。2026年10月更新。\n## テストとは\n出典：厚生労働省\n|a|b|",
        outgoing: [],
        faqCount: 2,
        summaryCount: 2,
        hasAuthoritativeSource: true,
        hasUpdateHistory: true,
        hasImage: true,
        hasComparisonTable: true,
      },
      {
        slug: "weak",
        title: "弱い記事",
        keyword: "テスト",
        body: "本文だけです。",
        outgoing: [],
        faqCount: 0,
        summaryCount: 0,
        hasAuthoritativeSource: false,
        hasUpdateHistory: false,
        hasImage: false,
        hasComparisonTable: false,
      },
    ]);
    expect(scores.find((x) => x.slug === "strong")!.score).toBeGreaterThan(
      scores.find((x) => x.slug === "weak")!.score
    );
  });
});
