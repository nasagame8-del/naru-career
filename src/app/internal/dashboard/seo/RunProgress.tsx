"use client";

import { SEO_PHASE_LABELS, SEO_PHASE_ORDER, type SeoRun } from "@/types/seo-editor";

const ICONS: Record<string, string> = {
  done: "✓",
  running: "●",
  failed: "✕",
  skipped: "–",
  pending: "○",
};

const COLORS: Record<string, string> = {
  done: "text-green-600",
  running: "text-blue-600 animate-pulse",
  failed: "text-red-600",
  skipped: "text-gray-400",
  pending: "text-gray-300",
};

export function RunProgress({
  run,
  busyPhase,
  subLabel,
}: {
  run: SeoRun;
  busyPhase: string | null;
  subLabel: string | null;
}) {
  // Phase 1 は候補取得なので進捗表示からは外す
  const phases = SEO_PHASE_ORDER.filter((p) => p !== "topics");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">
          {run.selectedTopic?.topic ?? "SEO Editor"}
        </h3>
        <span className="text-[10px] text-gray-400 select-all">{run.id}</span>
      </div>

      <ul className="space-y-1.5">
        {phases.map((id) => {
          const p = run.phases.find((x) => x.phase === id);
          const state = busyPhase === id ? "running" : (p?.state ?? "pending");
          return (
            <li key={id} className="flex items-start gap-2 text-xs">
              <span className={`w-4 shrink-0 font-mono ${COLORS[state]}`}>{ICONS[state]}</span>
              <span className={state === "pending" ? "text-gray-400" : "text-gray-800"}>
                {SEO_PHASE_LABELS[id]}
                {busyPhase === id && subLabel && (
                  <span className="ml-2 text-[10px] text-blue-600">{subLabel}</span>
                )}
              </span>
              {p?.state === "failed" && p.error && (
                <span className="text-[10px] text-red-600 ml-1">{p.error}</span>
              )}
              {p?.state === "skipped" && p.error && (
                <span className="text-[10px] text-gray-400 ml-1">{p.error}</span>
              )}
            </li>
          );
        })}
      </ul>

      {run.warnings.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-amber-700 cursor-pointer">
            警告 {run.warnings.length}件
          </summary>
          <ul className="mt-1.5 space-y-1 text-[11px] text-amber-800 list-disc pl-4">
            {run.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
