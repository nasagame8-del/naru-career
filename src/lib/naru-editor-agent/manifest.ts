/**
 * NARU Editor Agent v1 — daily manifest + pure evidence reconciler.
 *
 * Repository path convention (no filesystem I/O here): `data/editor-agent/run-YYYY-MM-DD.json`.
 * The manifest stores facts only. Evaluation is derived via `manifestToRunFacts` + `evaluateRun`.
 */
import { IMAGE_SLOT_KEYS } from "./types";
import type { ArticleSlotFacts, EditorRunFacts, GateFact, ImageSlotKey, SlotOrder } from "./types";

export const MANIFEST_SCHEMA_VERSION = 1 as const;

export function manifestPath(date: string): string {
  assertDate(date);
  return `data/editor-agent/run-${date}.json`;
}

export interface EditorRunManifest {
  schemaVersion: 1;
  date: string;
  candidatesReady: boolean;
  blockers: string[];
  slots: { "1": ArticleSlotFacts; "2": ArticleSlotFacts };
  lastReconciledAt?: string;
}

/** Slot-level evidence: any subset of slot facts (order is implied by the key). */
export type SlotEvidence = Partial<Omit<ArticleSlotFacts, "order">> & {
  /** Explicitly replaces the slot's blockers (use [] to clear). Omission never clears. */
  replaceBlockers?: string[];
};

export interface EditorRunEvidence {
  candidatesReady?: boolean | null;
  /** Blockers to add (union with existing). */
  blockers?: string[] | null;
  /** Explicitly replaces run blockers (use [] to clear). */
  replaceBlockers?: string[] | null;
  slots?: Partial<Record<"1" | "2", SlotEvidence | null>> | null;
  reconciledAt?: string | null;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(`editor-agent manifest: ${message}`);
    this.name = "ManifestError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(date: unknown): asserts date is string {
  if (typeof date !== "string" || !DATE_RE.test(date)) throw new ManifestError(`invalid date: ${String(date)}`);
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new ManifestError(`invalid calendar date: ${date}`);
  }
}

export function createEmptyManifest(date: string): EditorRunManifest {
  assertDate(date);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    date,
    candidatesReady: false,
    blockers: [],
    slots: { "1": { order: 1 }, "2": { order: 2 } },
  };
}

// ---------- parsing helpers ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function str(o: Obj, k: string, where: string): string | undefined {
  const v = o[k];
  if (v == null) return undefined;
  if (typeof v !== "string") throw new ManifestError(`${where}.${k} must be a string`);
  return v;
}
function bool(o: Obj, k: string, where: string): boolean | undefined {
  const v = o[k];
  if (v == null) return undefined;
  if (typeof v !== "boolean") throw new ManifestError(`${where}.${k} must be a boolean`);
  return v;
}
function num(o: Obj, k: string, where: string): number | undefined {
  const v = o[k];
  if (v == null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ManifestError(`${where}.${k} must be a number`);
  return v;
}
function strList(v: unknown, where: string): string[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new ManifestError(`${where} must be an array of strings`);
  }
  return [...new Set(v as string[])];
}

function gate(v: unknown, where: string): GateFact | undefined {
  if (v == null) return undefined;
  if (!isObj(v)) throw new ManifestError(`${where} must be an object`);
  const out: GateFact = {};
  const passed = bool(v, "passed", where);
  const headSha = str(v, "headSha", where);
  if (passed !== undefined) out.passed = passed;
  if (headSha !== undefined) out.headSha = headSha;
  return out;
}

function strMap(v: unknown, where: string): Record<string, string> | undefined {
  if (v == null) return undefined;
  if (!isObj(v)) throw new ManifestError(`${where} must be an object`);
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x == null) continue;
    if (typeof x !== "string") throw new ManifestError(`${where}.${k} must be a string`);
    out[k] = x;
  }
  return out;
}

function set<T extends object>(target: T, key: string, value: unknown) {
  if (value !== undefined) (target as Obj)[key] = value;
}

/** Parse the slot-evidence subset of facts (shared by manifest normalization and evidence parsing). */
function parseSlotFields(raw: Obj, where: string): SlotEvidence {
  const out: SlotEvidence = {};
  for (const k of ["batchId", "candidateId", "articleId", "slug", "title", "branch", "prUrl", "latestHeadSha",
    "previewApprovedHeadSha", "requestedPublishAt", "mergeSha", "publicArticleUrl"] as const) {
    set(out, k, str(raw, k, where));
  }
  for (const k of ["selected", "draftReady", "productionDeployVerified", "publicArticleVerified"] as const) {
    set(out, k, bool(raw, k, where));
  }
  set(out, "prNumber", num(raw, "prNumber", where));
  for (const k of ["imageQa", "articleQa", "ci"] as const) set(out, k, gate(raw[k], `${where}.${k}`));
  if (raw.drive != null) {
    if (!isObj(raw.drive)) throw new ManifestError(`${where}.drive must be an object`);
    const d: NonNullable<ArticleSlotFacts["drive"]> = {};
    for (const k of ["articleId", "imagesId", "promptId"] as const) set(d, k, str(raw.drive, k, `${where}.drive`));
    out.drive = d;
  }
  if (raw.images != null) {
    if (!isObj(raw.images)) throw new ManifestError(`${where}.images must be an object`);
    const imgs: Partial<Record<ImageSlotKey, { ref: string }>> = {};
    for (const k of IMAGE_SLOT_KEYS) {
      const v = raw.images[k];
      if (v == null) continue;
      if (!isObj(v)) throw new ManifestError(`${where}.images.${k} must be an object`);
      const ref = str(v, "ref", `${where}.images.${k}`);
      if (ref !== undefined) imgs[k] = { ref };
    }
    out.images = imgs;
  }
  set(out, "timestamps", strMap(raw.timestamps, `${where}.timestamps`));
  set(out, "blockers", strList(raw.blockers, `${where}.blockers`));
  return out;
}

function parseSlot(raw: unknown, order: SlotOrder): ArticleSlotFacts {
  if (raw == null) return { order };
  const where = `slots.${order}`;
  if (!isObj(raw)) throw new ManifestError(`${where} must be an object`);
  if (raw.order != null && raw.order !== order) throw new ManifestError(`${where}.order must be ${order}`);
  return { order, ...parseSlotFields(raw, where) } as ArticleSlotFacts;
}

/** Validate and normalize a parsed manifest. Unknown fields are dropped; malformed critical fields throw. */
export function normalizeManifest(parsed: unknown): EditorRunManifest {
  if (!isObj(parsed)) throw new ManifestError("manifest must be an object");
  if (parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new ManifestError(`unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  assertDate(parsed.date);
  if (parsed.candidatesReady != null && typeof parsed.candidatesReady !== "boolean") {
    throw new ManifestError("candidatesReady must be a boolean");
  }
  if (parsed.slots != null && !isObj(parsed.slots)) throw new ManifestError("slots must be an object");
  const slots = (parsed.slots ?? {}) as Obj;
  const manifest: EditorRunManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    date: parsed.date,
    candidatesReady: parsed.candidatesReady === true,
    blockers: strList(parsed.blockers, "blockers") ?? [],
    slots: { "1": parseSlot(slots["1"], 1), "2": parseSlot(slots["2"], 2) },
  };
  const at = str(parsed, "lastReconciledAt", "manifest");
  if (at !== undefined) manifest.lastReconciledAt = at;
  return manifest;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .filter((k) => v[k] !== undefined)
        .map((k) => [k, sortKeys(v[k])]),
    );
  }
  return v;
}

/** Deterministic JSON (sorted keys, 2-space indent, trailing newline) of the normalized manifest. */
export function serializeManifest(manifest: EditorRunManifest): string {
  return `${JSON.stringify(sortKeys(normalizeManifest(manifest)), null, 2)}\n`;
}

export function parseManifest(json: string): EditorRunManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ManifestError("invalid JSON");
  }
  return normalizeManifest(parsed);
}

/** Manifest -> existing evaluator input. Evaluation is derived, never stored. */
export function manifestToRunFacts(manifest: EditorRunManifest): EditorRunFacts {
  const m = normalizeManifest(manifest);
  return {
    runId: `run-${m.date}`,
    date: m.date,
    candidatesReady: m.candidatesReady,
    blockers: m.blockers,
    slots: { "1": m.slots["1"], "2": m.slots["2"] },
  };
}

// ---------- reconciler ----------

const union = (a: string[] | null | undefined, b: string[]) => [...new Set([...(a ?? []), ...b])];

function parseEvidenceSlot(raw: unknown, order: SlotOrder): SlotEvidence {
  if (raw == null) return {};
  const where = `evidence.slots.${order}`;
  if (!isObj(raw)) throw new ManifestError(`${where} must be an object`);
  const ev = parseSlotFields(raw, where);
  const replace = strList(raw.replaceBlockers, `${where}.replaceBlockers`);
  if (raw.selected != null && typeof raw.selected !== "boolean") throw new ManifestError(`${where}.selected must be a boolean`);
  // Selection stays explicit: only `true` is ever applied; `false` is treated as not supplied.
  if (ev.selected !== true) delete ev.selected;
  if (replace !== undefined) ev.replaceBlockers = replace;
  return ev;
}

function mergeSlot(existing: ArticleSlotFacts, evidence: SlotEvidence, order: SlotOrder): ArticleSlotFacts {
  const { replaceBlockers, images, drive, timestamps, blockers, ...scalars } = evidence;
  for (const k of ["candidateId", "articleId", "slug"] as const) {
    const have = existing[k];
    const next = scalars[k];
    if (have != null && next != null && have !== next) {
      throw new ManifestError(`slot ${order} ${k} conflict: existing "${have}" vs evidence "${next}"`);
    }
  }
  const out: ArticleSlotFacts = { ...existing, ...scalars, order };
  if (drive) out.drive = { ...(existing.drive ?? {}), ...drive };
  if (images) out.images = { ...(existing.images ?? {}), ...images };
  if (timestamps) out.timestamps = { ...(existing.timestamps ?? {}), ...timestamps };
  if (replaceBlockers !== undefined) out.blockers = [...replaceBlockers];
  else if (blockers) out.blockers = union(existing.blockers, blockers);
  return out;
}

/**
 * Merge partial evidence into an existing manifest. Pure; returns a new manifest.
 * Only supplied fields change; omission/null never erases; identity conflicts throw.
 */
export function reconcileRunManifest(existing: EditorRunManifest, evidence: EditorRunEvidence): EditorRunManifest {
  const base = normalizeManifest(existing);
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    throw new ManifestError("evidence must be an object");
  }
  if (evidence.candidatesReady != null && typeof evidence.candidatesReady !== "boolean") {
    throw new ManifestError("evidence.candidatesReady must be a boolean");
  }
  const addBlockers = strList(evidence.blockers, "evidence.blockers");
  const replaceBlockers = strList(evidence.replaceBlockers, "evidence.replaceBlockers");
  const at = evidence.reconciledAt;
  if (at != null && typeof at !== "string") throw new ManifestError("evidence.reconciledAt must be a string");
  if (evidence.slots != null && !isObj(evidence.slots)) throw new ManifestError("evidence.slots must be an object");
  const slotEv = (evidence.slots ?? {}) as Obj;

  const next: EditorRunManifest = {
    ...base,
    slots: {
      "1": mergeSlot(base.slots["1"], parseEvidenceSlot(slotEv["1"], 1), 1),
      "2": mergeSlot(base.slots["2"], parseEvidenceSlot(slotEv["2"], 2), 2),
    },
  };
  if (evidence.candidatesReady != null) next.candidatesReady = evidence.candidatesReady;
  if (replaceBlockers !== undefined) next.blockers = [...replaceBlockers];
  else if (addBlockers) next.blockers = union(base.blockers, addBlockers);
  if (at != null) next.lastReconciledAt = at;
  return normalizeManifest(next);
}
