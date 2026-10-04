import { describe, expect, it } from "vitest";
import { evaluateArticleSlot, evaluateRun } from "./evaluate";
import type { ArticleSlotFacts } from "./types";

const img = (n: number) => {
  const keys = ["card", "01", "02", "03"] as const;
  return Object.fromEntries(keys.slice(0, n).map((k) => [k, { ref: `drive-${k}` }]));
};

const drafted = (over: Partial<ArticleSlotFacts> = {}): ArticleSlotFacts => ({
  order: 1,
  selected: true,
  candidateId: "c1",
  slug: "s",
  branch: "b",
  prNumber: 1,
  draftReady: true,
  latestHeadSha: "aaa",
  images: img(4),
  ...over,
});

const gate = (sha: string) => ({ passed: true, headSha: sha });
const allGates = (sha = "aaa") => ({ imageQa: gate(sha), factCheck: gate(sha), articleQa: gate(sha), ci: gate(sha) });
const approved = (over: Partial<ArticleSlotFacts> = {}) =>
  drafted({ ...allGates(), previewApprovedHeadSha: "aaa", ...over });

describe("evaluateArticleSlot", () => {
  it("1. unselected slot needs human selection", () => {
    const r = evaluateArticleSlot({ order: 1, candidateId: "c1" });
    expect(r.state).toBe("UNSELECTED");
    expect(r.humanGate).toBe("selection");
  });

  it("2. selected -> drafting -> waiting images", () => {
    expect(evaluateArticleSlot({ order: 1, selected: true, candidateId: "c1" }).state).toBe("SELECTED");
    expect(evaluateArticleSlot({ order: 1, selected: true, candidateId: "c1", branch: "b" }).state).toBe("DRAFTING");
    const r = evaluateArticleSlot(drafted({ images: {} }));
    expect(r.state).toBe("WAITING_IMAGES");
    expect(r.humanGate).toBe("images");
  });

  it("3. 3 images is not enough", () => {
    const r = evaluateArticleSlot(drafted({ images: img(3) }));
    expect(r.state).toBe("WAITING_IMAGES");
    expect(r.reasons[0]).toContain("03");
  });

  it("4. 4 images advances", () => {
    expect(evaluateArticleSlot(drafted()).state).toBe("IMAGE_QA");
    expect(evaluateArticleSlot(drafted({ imageQa: gate("aaa") })).state).toBe("ARTICLE_QA");
  });

  it("5. approval SHA mismatch blocks, including after head change", () => {
    const r = evaluateArticleSlot(approved({ previewApprovedHeadSha: "old" }));
    expect(r.state).toBe("WAITING_PREVIEW_APPROVAL");
    expect(r.humanGate).toBe("preview-approval");
    const moved = evaluateArticleSlot(approved({ latestHeadSha: "bbb" }));
    expect(moved.state).toBe("IMAGE_QA");
    const movedGates = evaluateArticleSlot(approved({ latestHeadSha: "bbb", ...allGates("bbb") }));
    expect(movedGates.state).toBe("WAITING_PREVIEW_APPROVAL");
  });

  it("6. matching approval + QA/CI + human fact check => ready to schedule", () => {
    expect(evaluateArticleSlot(approved()).state).toBe("READY_TO_SCHEDULE");
    expect(evaluateArticleSlot(approved({ ci: gate("old") })).state).toBe("ARTICLE_QA");
    const missingFactCheck = approved();
    delete missingFactCheck.factCheck;
    const blocked = evaluateArticleSlot(missingFactCheck);
    expect(blocked.state).toBe("ARTICLE_QA");
    expect(blocked.nextAction).toBe("record-human-fact-check");
  });

  it("7. explicit requestedPublishAt => scheduled", () => {
    const r = evaluateArticleSlot(approved({ requestedPublishAt: "2026-10-05T07:00:00+09:00" }));
    expect(r.state).toBe("SCHEDULED");
  });

  it("8. merge without production verification is not published", () => {
    const r = evaluateArticleSlot(approved({ mergeSha: "m1", requestedPublishAt: "2026-10-05T07:00:00+09:00" }));
    expect(r.state).toBe("PUBLISHING");
    const partial = evaluateArticleSlot(
      approved({ mergeSha: "m1", productionDeployVerified: true, publicArticleUrl: "https://naru-career.com/articles/s" }),
    );
    expect(partial.state).toBe("PUBLISHING");
  });

  it("9. production verified + real URL verified => published", () => {
    const r = evaluateArticleSlot(
      approved({
        mergeSha: "m1",
        productionDeployVerified: true,
        publicArticleUrl: "https://naru-career.com/articles/s",
        publicArticleVerified: true,
      }),
    );
    expect(r.state).toBe("PUBLISHED");
    expect(r.nextAction).toBe("none");
  });

  it("10. blocker => held and facts are untouched", () => {
    const facts = approved({ blockers: ["ci flaky"] });
    const before = JSON.stringify(facts);
    const r = evaluateArticleSlot(facts);
    expect(r.state).toBe("HELD");
    expect(JSON.stringify(facts)).toBe(before);
    expect(evaluateArticleSlot({ ...facts, blockers: [] }).state).toBe("READY_TO_SCHEDULE");
  });

  it("12. repeated evaluation is identical", () => {
    const facts = approved({ requestedPublishAt: "2026-10-05T07:00:00+09:00" });
    const a = evaluateArticleSlot(facts);
    expect(evaluateArticleSlot(facts)).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe("evaluateRun", () => {
  it("covers run states", () => {
    expect(evaluateRun({}).state).toBe("CANDIDATE_RESEARCH_PENDING");
    expect(evaluateRun({ candidatesReady: true }).state).toBe("WAITING_SELECTION");
    expect(evaluateRun({ candidatesReady: true, blockers: ["x"] }).state).toBe("HELD");
  });

  it("11. two slots progress independently", () => {
    const run = evaluateRun({
      candidatesReady: true,
      slots: {
        "1": approved({ order: 1, blockers: ["stuck"] }),
        "2": approved({ order: 2, requestedPublishAt: "2026-10-05T07:00:00+09:00" }),
      },
    });
    expect(run.slots[0].state).toBe("HELD");
    expect(run.slots[1].state).toBe("SCHEDULED");
    expect(run.state).toBe("ACTIVE");

    const mixed = evaluateRun({
      candidatesReady: true,
      slots: { "1": drafted({ order: 1, images: img(2) }) },
    });
    expect(mixed.slots[0].state).toBe("WAITING_IMAGES");
    expect(mixed.slots[1].state).toBe("UNSELECTED");
    expect(mixed.pendingHumanGates).toEqual([
      { order: 1, gate: "images" },
      { order: 2, gate: "selection" },
    ]);
  });

  it("completes only when both slots are published", () => {
    const pub = (order: 1 | 2) =>
      approved({
        order,
        mergeSha: "m",
        productionDeployVerified: true,
        publicArticleUrl: "https://naru-career.com/articles/s",
        publicArticleVerified: true,
      });
    expect(evaluateRun({ candidatesReady: true, slots: { "1": pub(1), "2": pub(2) } }).state).toBe("COMPLETED");
    expect(evaluateRun({ candidatesReady: true, slots: { "1": pub(1) } }).state).toBe("ACTIVE");
  });
});
