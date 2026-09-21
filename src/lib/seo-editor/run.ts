/**
 * SeoRun のライフサイクル管理。
 *
 * 1回のSEO改善処理 = 1 SeoRun。
 * 各Phaseの結果を保存し、途中で失敗してもどこまで成功したかが分かるようにする。
 */

import {
  SEO_PHASE_ORDER,
  type SeoPhaseId,
  type SeoPhaseState,
  type SeoRun,
  type SeoUsage,
} from "@/types/seo-editor";

export function newRunId(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDhhmmss
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${stamp}-${rand}`;
}

export function createRun(): SeoRun {
  const now = new Date().toISOString();
  return {
    id: newRunId(),
    createdAt: now,
    updatedAt: now,
    status: "idle",
    currentPhase: "topics",
    phases: SEO_PHASE_ORDER.map((phase) => ({ phase, state: "pending" as SeoPhaseState })),
    selection: null,
    selectedTopic: null,
    cannibalization: null,
    clusterAudit: null,
    actionDecision: null,
    internalLinks: null,
    briefs: [],
    changes: [],
    qa: null,
    research: [],
    publish: null,
    usage: [],
    warnings: [],
  };
}

export function phaseIndex(phase: SeoPhaseId): number {
  return SEO_PHASE_ORDER.indexOf(phase);
}

export function markPhaseRunning(run: SeoRun, phase: SeoPhaseId): SeoRun {
  const now = new Date().toISOString();
  return {
    ...run,
    status: "running",
    currentPhase: phase,
    updatedAt: now,
    phases: run.phases.map((p) =>
      p.phase === phase
        ? { ...p, state: "running", startedAt: now, finishedAt: undefined, error: undefined }
        : p
    ),
  };
}

export function markPhaseDone(run: SeoRun, phase: SeoPhaseId, usage: SeoUsage[] = []): SeoRun {
  const now = new Date().toISOString();
  const isLast = phaseIndex(phase) === SEO_PHASE_ORDER.length - 1;
  return {
    ...run,
    status: isLast ? "completed" : "running",
    currentPhase: phase,
    updatedAt: now,
    usage: [...run.usage, ...usage],
    phases: run.phases.map((p) =>
      p.phase === phase
        ? { ...p, state: "done", finishedAt: now, error: undefined, usage }
        : p
    ),
  };
}

export function markPhaseFailed(run: SeoRun, phase: SeoPhaseId, error: string): SeoRun {
  const now = new Date().toISOString();
  return {
    ...run,
    status: "failed",
    currentPhase: phase,
    updatedAt: now,
    phases: run.phases.map((p) =>
      p.phase === phase ? { ...p, state: "failed", finishedAt: now, error } : p
    ),
  };
}

export function markPhaseSkipped(run: SeoRun, phase: SeoPhaseId, reason: string): SeoRun {
  const now = new Date().toISOString();
  return {
    ...run,
    updatedAt: now,
    warnings: [...run.warnings, `${phase}: ${reason}`],
    phases: run.phases.map((p) =>
      p.phase === phase ? { ...p, state: "skipped", finishedAt: now, error: reason } : p
    ),
  };
}

export function addWarnings(run: SeoRun, warnings: string[]): SeoRun {
  if (warnings.length === 0) return run;
  const existing = new Set(run.warnings);
  const added = warnings.filter((w) => !existing.has(w));
  if (added.length === 0) return run;
  return { ...run, warnings: [...run.warnings, ...added] };
}

/** 直前のPhaseが完了しているか。順序を飛ばした実行を防ぐ */
export function assertPhaseReady(run: SeoRun, phase: SeoPhaseId): string | null {
  const idx = phaseIndex(phase);
  if (idx <= 0) return null;
  const prev = SEO_PHASE_ORDER[idx - 1];
  const state = run.phases.find((p) => p.phase === prev)?.state;
  if (state === "done" || state === "skipped") return null;
  return `前のPhase「${prev}」が完了していません（現在: ${state ?? "unknown"}）`;
}

/** クライアントから返ってきたRunを最低限検証する（untrusted入力） */
export function isSeoRun(value: unknown): value is SeoRun {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<SeoRun>;
  return typeof r.id === "string" && Array.isArray(r.phases) && Array.isArray(r.changes);
}

export function totalUsage(run: SeoRun): { inputTokens: number; outputTokens: number; calls: number } {
  return run.usage.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      calls: acc.calls + 1,
    }),
    { inputTokens: 0, outputTokens: 0, calls: 0 }
  );
}
