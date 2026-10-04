/**
 * NARU Editor Agent v1 — editorial state model.
 * Everything here is plain JSON-serializable data. Unknown values are null/undefined, never invented.
 */

export const RUN_STATES = [
  "CANDIDATE_RESEARCH_PENDING",
  "WAITING_SELECTION",
  "ACTIVE",
  "COMPLETED",
  "HELD",
] as const;
export type RunState = (typeof RUN_STATES)[number];

export const SLOT_STATES = [
  "UNSELECTED",
  "SELECTED",
  "DRAFTING",
  "WAITING_IMAGES",
  "IMAGE_QA",
  "ARTICLE_QA",
  "WAITING_PREVIEW_APPROVAL",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "HELD",
] as const;
export type SlotState = (typeof SLOT_STATES)[number];

export const IMAGE_SLOT_KEYS = ["card", "01", "02", "03"] as const;
export type ImageSlotKey = (typeof IMAGE_SLOT_KEYS)[number];

export type HumanGate = "selection" | "images" | "preview-approval";

export type SlotOrder = 1 | 2;

export interface ImageSlotFact {
  /** Drive file ID or repository path of the delivered image. Null/absent = not delivered. */
  ref?: string | null;
}

/** A QA/CI result is only meaningful for the head SHA it was recorded against. */
export interface GateFact {
  passed?: boolean | null;
  headSha?: string | null;
}

export interface ArticleSlotFacts {
  order: SlotOrder;
  batchId?: string | null;
  candidateId?: string | null;
  /** Explicit human selection. Never inferred from candidateId alone. */
  selected?: boolean | null;
  articleId?: string | null;
  slug?: string | null;
  title?: string | null;
  branch?: string | null;
  prNumber?: number | null;
  prUrl?: string | null;
  /** True once a draft exists on the article branch. */
  draftReady?: boolean | null;
  latestHeadSha?: string | null;
  previewApprovedHeadSha?: string | null;
  drive?: {
    articleId?: string | null;
    imagesId?: string | null;
    promptId?: string | null;
  } | null;
  images?: Partial<Record<ImageSlotKey, ImageSlotFact | null>> | null;
  requestedPublishAt?: string | null;
  imageQa?: GateFact | null;
  /** Human fact-check approval for this exact head SHA. AI self-review must not set this. */
  factCheck?: GateFact | null;
  articleQa?: GateFact | null;
  ci?: GateFact | null;
  mergeSha?: string | null;
  productionDeployVerified?: boolean | null;
  publicArticleUrl?: string | null;
  publicArticleVerified?: boolean | null;
  blockers?: string[] | null;
  timestamps?: Record<string, string | null> | null;
}

export interface EditorRunFacts {
  runId?: string | null;
  /** Date of the daily run (YYYY-MM-DD). */
  date?: string | null;
  candidatesReady?: boolean | null;
  blockers?: string[] | null;
  slots?: Partial<Record<"1" | "2", ArticleSlotFacts | null>> | null;
  timestamps?: Record<string, string | null> | null;
}

export interface SlotEvaluation {
  order: SlotOrder;
  state: SlotState;
  nextAction: string;
  humanGate: HumanGate | null;
  reasons: string[];
}

export interface RunEvaluation {
  state: RunState;
  slots: [SlotEvaluation, SlotEvaluation];
  pendingHumanGates: { order: SlotOrder; gate: HumanGate }[];
  reasons: string[];
}
