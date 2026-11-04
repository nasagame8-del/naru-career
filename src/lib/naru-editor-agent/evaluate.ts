import {
  IMAGE_SLOT_KEYS,
  type ArticleSlotFacts,
  type EditorRunFacts,
  type GateFact,
  type RunEvaluation,
  type SlotEvaluation,
  type SlotOrder,
  type SlotState,
} from "./types";

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function cleanBlockers(blockers: string[] | null | undefined): string[] {
  return (blockers ?? []).filter(nonEmpty);
}

export function missingImageSlots(facts: ArticleSlotFacts) {
  return IMAGE_SLOT_KEYS.filter((key) => !nonEmpty(facts.images?.[key]?.ref));
}

/** A gate counts only if it passed on exactly the current head SHA. */
export function gateValid(gate: GateFact | null | undefined, latestHeadSha: string | null | undefined) {
  return (
    gate?.passed === true &&
    nonEmpty(latestHeadSha) &&
    gate.headSha === latestHeadSha
  );
}

/** Preview approval is valid only for the exact current head SHA. */
export function previewApprovalValid(facts: ArticleSlotFacts) {
  return nonEmpty(facts.latestHeadSha) && facts.previewApprovedHeadSha === facts.latestHeadSha;
}

export function isPublishedFactsComplete(facts: ArticleSlotFacts) {
  return (
    nonEmpty(facts.mergeSha) &&
    facts.productionDeployVerified === true &&
    nonEmpty(facts.publicArticleUrl) &&
    facts.publicArticleVerified === true
  );
}

function result(
  facts: ArticleSlotFacts,
  state: SlotState,
  nextAction: string,
  humanGate: SlotEvaluation["humanGate"],
  reasons: string[],
): SlotEvaluation {
  return { order: facts.order, state, nextAction, humanGate, reasons };
}

/** Pure: derives the slot state and next action from normalized facts. */
export function evaluateArticleSlot(facts: ArticleSlotFacts): SlotEvaluation {
  const blockers = cleanBlockers(facts.blockers);
  if (blockers.length > 0) {
    return result(facts, "HELD", "resolve-blockers", null, blockers.map((b) => `blocker: ${b}`));
  }

  if (facts.selected !== true || !nonEmpty(facts.candidateId)) {
    return result(facts, "UNSELECTED", "wait-for-selection", "selection", [
      "no explicit selection recorded",
    ]);
  }

  const hasDraft =
    facts.draftReady === true && nonEmpty(facts.slug) && nonEmpty(facts.branch) && facts.prNumber != null;
  if (!hasDraft) {
    const started = nonEmpty(facts.branch) || facts.prNumber != null || nonEmpty(facts.articleId);
    return started
      ? result(facts, "DRAFTING", "finish-draft", null, ["draft not ready"])
      : result(facts, "SELECTED", "start-draft", null, ["selected; draft not started"]);
  }

  const missing = missingImageSlots(facts);
  if (missing.length > 0) {
    return result(facts, "WAITING_IMAGES", "provide-images", "images", [
      `missing images: ${missing.join(", ")}`,
    ]);
  }

  const head = facts.latestHeadSha;
  if (!nonEmpty(head)) {
    return result(facts, "IMAGE_QA", "record-head-sha", null, ["latestHeadSha unknown"]);
  }
  if (!gateValid(facts.imageQa, head)) {
    return result(facts, "IMAGE_QA", "run-image-qa", null, ["image QA not passed on latest head"]);
  }
  if (!gateValid(facts.articleQa, head)) {
    return result(facts, "ARTICLE_QA", "run-article-qa", null, ["article QA not passed on latest head"]);
  }
  if (!gateValid(facts.ci, head)) {
    return result(facts, "ARTICLE_QA", "wait-for-ci", null, ["CI not passed on latest head"]);
  }

  if (!previewApprovalValid(facts)) {
    const stale = nonEmpty(facts.previewApprovedHeadSha);
    return result(facts, "WAITING_PREVIEW_APPROVAL", "request-preview-approval", "preview-approval", [
      stale ? "preview approval is for a different head SHA" : "preview not approved",
    ]);
  }

  if (!gateValid(facts.factCheck, head)) {
    return result(facts, "ARTICLE_QA", "record-human-fact-check", null, [
      "human fact check not passed on latest head",
    ]);
  }

  if (nonEmpty(facts.mergeSha)) {
    if (isPublishedFactsComplete(facts)) {
      return result(facts, "PUBLISHED", "none", null, ["merged, deploy verified, public URL verified"]);
    }
    const reasons: string[] = [];
    if (facts.productionDeployVerified !== true) reasons.push("production deploy not verified");
    if (!nonEmpty(facts.publicArticleUrl)) reasons.push("public article URL unknown");
    if (facts.publicArticleVerified !== true) reasons.push("public article not verified");
    return result(facts, "PUBLISHING", "verify-production", null, reasons);
  }

  if (!nonEmpty(facts.requestedPublishAt)) {
    return result(facts, "READY_TO_SCHEDULE", "request-publish-time", null, [
      "QA, CI and preview approval valid; requestedPublishAt not set",
    ]);
  }
  return result(facts, "SCHEDULED", "merge-at-requested-time", null, [
    `scheduled for ${facts.requestedPublishAt}`,
  ]);
}

function slotFacts(run: EditorRunFacts, order: SlotOrder): ArticleSlotFacts {
  const found = run.slots?.[String(order) as "1" | "2"];
  return { ...(found ?? {}), order };
}

/** Pure: slots are evaluated independently; neither blocks the other. */
export function evaluateRun(run: EditorRunFacts): RunEvaluation {
  const slots: [SlotEvaluation, SlotEvaluation] = [
    evaluateArticleSlot(slotFacts(run, 1)),
    evaluateArticleSlot(slotFacts(run, 2)),
  ];
  const pendingHumanGates = slots.flatMap((s) =>
    s.humanGate ? [{ order: s.order, gate: s.humanGate }] : [],
  );

  const runBlockers = cleanBlockers(run.blockers);
  let state: RunEvaluation["state"];
  let reasons: string[];
  if (runBlockers.length > 0) {
    state = "HELD";
    reasons = runBlockers.map((b) => `blocker: ${b}`);
  } else if (run.candidatesReady !== true && slots.every((s) => s.state === "UNSELECTED")) {
    state = "CANDIDATE_RESEARCH_PENDING";
    reasons = ["candidate research not complete"];
  } else if (slots.every((s) => s.state === "PUBLISHED")) {
    state = "COMPLETED";
    reasons = ["both slots published and verified"];
  } else if (slots.every((s) => s.state === "UNSELECTED")) {
    state = "WAITING_SELECTION";
    reasons = ["waiting for human selection of 2 articles"];
  } else if (slots.every((s) => s.state === "HELD" || s.state === "PUBLISHED")) {
    state = "HELD";
    reasons = ["no slot can progress"];
  } else {
    state = "ACTIVE";
    reasons = ["at least one slot is in progress"];
  }
  return { state, slots, pendingHumanGates, reasons };
}
