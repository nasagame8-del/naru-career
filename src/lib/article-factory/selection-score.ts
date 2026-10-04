import type {
  CandidateSelectionEvidence,
  CandidateSelectionGrade,
} from "./types";

export interface CandidateSelectionScore {
  score: number;
  grade: CandidateSelectionGrade;
  gatePassed: boolean;
  blocked: boolean;
  reasons: string[];
}

const GSC_POINTS = { strong: 35, medium: 25, weak: 10, none: 0 } as const;
const SERP_POINTS = { high: 25, medium: 15, low: 5, unchecked: 0 } as const;
const TREND_POINTS = { rising: 10, stable: 5, falling: 0, unavailable: 0 } as const;
const EXPANSION_POINTS = { high: 10, medium: 6, low: 2, unavailable: 0 } as const;
const CLUSTER_POINTS = { strong: 15, medium: 8, weak: 0 } as const;

function gradeFor(score: number): CandidateSelectionGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

/**
 * 有料キーワードAPIなしで、朝8時の候補を比較するための決定的スコア。
 *
 * 最大100点:
 * - GSC 35
 * - SERP 25
 * - Trends 10
 * - サジェスト/PAA/関連検索 10
 * - クラスター適合 15
 * - 一次情報・独自角度 5
 *
 * 中程度のカニバリ懸念は -20。高リスクは点数に関係なくブロックする。
 */
export function scoreCandidateSelection(
  evidence: CandidateSelectionEvidence
): CandidateSelectionScore {
  const reasons: string[] = [];

  if (evidence.cannibalizationRisk === "high") {
    return {
      score: 0,
      grade: "D",
      gatePassed: false,
      blocked: true,
      reasons: ["既存記事との検索意図重複リスクが高いため候補化しません"],
    };
  }

  let score =
    GSC_POINTS[evidence.gsc] +
    SERP_POINTS[evidence.serp] +
    TREND_POINTS[evidence.trends] +
    EXPANSION_POINTS[evidence.demandExpansions] +
    CLUSTER_POINTS[evidence.clusterFit] +
    (evidence.originalAngle ? 5 : 0);

  if (evidence.cannibalizationRisk === "medium") {
    score -= 20;
    reasons.push("既存記事との役割分担が必要なため20点減点");
  }

  score = Math.max(0, Math.min(100, score));

  const gscBacked =
    evidence.gsc === "strong" ||
    evidence.gsc === "medium" ||
    (evidence.gsc === "weak" && evidence.clusterFit === "strong");
  const webDemandBacked =
    (evidence.serp === "high" || evidence.serp === "medium") &&
    (evidence.demandExpansions === "high" || evidence.demandExpansions === "medium");
  const timelyOriginalBacked =
    evidence.trends === "rising" &&
    evidence.originalAngle &&
    (evidence.serp === "high" || evidence.serp === "medium");

  const gatePassed = gscBacked || webDemandBacked || timelyOriginalBacked;
  if (!gatePassed) {
    reasons.push(
      "GSC実測、SERP+周辺需要、または上昇トレンド+一次情報のいずれの根拠ゲートも満たしていません"
    );
  }

  return {
    score,
    grade: gradeFor(score),
    gatePassed,
    blocked: false,
    reasons,
  };
}
