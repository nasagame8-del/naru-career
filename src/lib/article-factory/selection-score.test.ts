import { describe, expect, it } from "vitest";
import { scoreCandidateSelection } from "./selection-score";
import type { CandidateSelectionEvidence } from "./types";

function base(overrides: Partial<CandidateSelectionEvidence> = {}): CandidateSelectionEvidence {
  return {
    gsc: "none",
    serp: "unchecked",
    trends: "unavailable",
    demandExpansions: "unavailable",
    clusterFit: "weak",
    originalAngle: false,
    cannibalizationRisk: "none",
    checkedAt: "2026-10-04T00:00:00.000Z",
    notes: [],
    ...overrides,
  };
}

describe("scoreCandidateSelection", () => {
  it("gives 100 to the strongest fully-supported candidate", () => {
    const result = scoreCandidateSelection(base({
      gsc: "strong",
      serp: "high",
      trends: "rising",
      demandExpansions: "high",
      clusterFit: "strong",
      originalAngle: true,
    }));
    expect(result).toMatchObject({ score: 100, grade: "A", gatePassed: true, blocked: false });
  });

  it("passes a new topic with medium SERP opportunity and multiple free demand expansions", () => {
    const result = scoreCandidateSelection(base({
      serp: "medium",
      demandExpansions: "medium",
      clusterFit: "strong",
    }));
    expect(result.gatePassed).toBe(true);
    expect(result.score).toBe(36);
  });

  it("does not invent strength when all external signals are unavailable", () => {
    const result = scoreCandidateSelection(base());
    expect(result).toMatchObject({ score: 0, grade: "D", gatePassed: false, blocked: false });
  });

  it("blocks high cannibalization regardless of other evidence", () => {
    const result = scoreCandidateSelection(base({
      gsc: "strong",
      serp: "high",
      trends: "rising",
      demandExpansions: "high",
      clusterFit: "strong",
      originalAngle: true,
      cannibalizationRisk: "high",
    }));
    expect(result).toMatchObject({ score: 0, grade: "D", gatePassed: false, blocked: true });
  });

  it("penalizes medium cannibalization by 20 points", () => {
    const result = scoreCandidateSelection(base({
      gsc: "medium",
      serp: "medium",
      clusterFit: "strong",
      cannibalizationRisk: "medium",
    }));
    expect(result.score).toBe(35);
    expect(result.gatePassed).toBe(true);
  });
});
