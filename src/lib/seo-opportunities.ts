import type {
  DecayingPage,
  QuickWinPage,
  SCPeriodData,
} from "../types/search-console";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/**
 * NARU向けQuick Win。
 * 大規模サイト向けの「500表示以上」ではなく、現状の母数に合わせて
 * query×page 単位で、5表示以上・平均5〜15位・0クリックまたはCTR 2%未満を拾う。
 */
export function buildQuickWins(current28d: SCPeriodData): QuickWinPage[] {
  return current28d.pageQueries
    .filter(
      (p) =>
        Boolean(p.keys[0]) &&
        Boolean(p.keys[1]) &&
        p.impressions >= 5 &&
        p.position >= 5 &&
        p.position <= 15 &&
        (p.clicks === 0 || p.ctr < 0.02)
    )
    .map((p): QuickWinPage => {
      const priority: QuickWinPage["priority"] =
        p.position <= 10 && p.impressions >= 10
          ? "high"
          : p.impressions >= 5
            ? "medium"
            : "low";
      return {
        ...p,
        page: p.keys[0],
        query: p.keys[1],
        priority,
        signal: p.clicks === 0 ? "zero_clicks" : "low_ctr",
      };
    })
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.impressions - a.impressions ||
        a.position - b.position
    );
}

/**
 * 前28日と比べたDecay候補。
 * 少数データのノイズを避けるため前期5表示以上を最低条件にし、
 * 表示40%以上減、または順位5以上悪化（かつ表示も増えていない）を拾う。
 */
export function buildDecayingPages(
  current28d: SCPeriodData,
  previous28d: SCPeriodData
): DecayingPage[] {
  const currentMap = new Map(current28d.topPages.map((p) => [p.keys[0], p]));

  return previous28d.topPages
    .filter((p) => p.impressions >= 5 && Boolean(p.keys[0]))
    .map((prev): DecayingPage | null => {
      const page = prev.keys[0];
      const current = currentMap.get(page);
      const currentImpressions = current?.impressions ?? 0;
      const impressionChange =
        prev.impressions > 0
          ? ((currentImpressions - prev.impressions) / prev.impressions) * 100
          : 0;
      const currentPosition =
        current && current.position > 0 ? current.position : null;
      const positionChange =
        currentPosition === null ? null : currentPosition - prev.position;

      const impressionsDropped = impressionChange <= -40;
      const rankDropped =
        positionChange !== null &&
        positionChange >= 5 &&
        currentImpressions <= prev.impressions;

      if (!impressionsDropped && !rankDropped) return null;

      const priority: DecayingPage["priority"] =
        prev.impressions >= 20 && impressionsDropped
          ? "high"
          : prev.impressions >= 10 || rankDropped
            ? "medium"
            : "low";

      return {
        page,
        currentClicks: current?.clicks ?? 0,
        previousClicks: prev.clicks,
        currentImpressions,
        previousImpressions: prev.impressions,
        impressionChange,
        currentPosition,
        previousPosition: prev.position,
        positionChange,
        priority,
      };
    })
    .filter((p): p is DecayingPage => p !== null)
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.impressionChange - b.impressionChange
    );
}
