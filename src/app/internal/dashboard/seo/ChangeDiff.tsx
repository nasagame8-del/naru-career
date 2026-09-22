"use client";

import { useMemo, useState } from "react";
import type { ArticleChange } from "@/types/seo-editor";

type Line = { kind: "same" | "add" | "del"; text: string };

/** 行単位のLCS差分。外部ライブラリを増やさないための最小実装 */
function diffLines(before: string, after: string): Line[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // 大きすぎる場合はLCSを諦め、全置換として表示する
  if (a.length * b.length > 400_000) {
    return [
      ...a.map((text) => ({ kind: "del" as const, text })),
      ...b.map((text) => ({ kind: "add" as const, text })),
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i] });
      i++;
    } else {
      out.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ kind: "del", text: a[i++] });
  while (j < n) out.push({ kind: "add", text: b[j++] });
  return out;
}

/** 変更のない行は前後3行だけ残す */
function collapse(lines: Line[], context = 3): (Line | { kind: "gap"; text: string })[] {
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.kind === "same") return;
    for (let k = i - context; k <= i + context; k++) if (k >= 0 && k < lines.length) keep.add(k);
  });
  const out: (Line | { kind: "gap"; text: string })[] = [];
  let gapping = false;
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      out.push(l);
      gapping = false;
    } else if (!gapping) {
      out.push({ kind: "gap", text: "…" });
      gapping = true;
    }
  });
  return out;
}

const OP_STYLES: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 border-green-200",
  UPDATE: "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

export function ChangeDiff({ change }: { change: ArticleChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"diff" | "after">("diff");

  const lines = useMemo(
    () => (open && mode === "diff" ? collapse(diffLines(change.before ?? "", change.after)) : []),
    [open, mode, change.before, change.after]
  );

  const stats = useMemo(() => {
    if (!change.before) return { add: change.after.split("\n").length, del: 0 };
    const d = diffLines(change.before, change.after);
    return {
      add: d.filter((l) => l.kind === "add").length,
      del: d.filter((l) => l.kind === "del").length,
    };
  }, [change.before, change.after]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="text-gray-400 text-xs w-3">{open ? "▾" : "▸"}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${OP_STYLES[change.operation]}`}
        >
          {change.operation}
        </span>
        <code className="text-xs text-gray-800 truncate flex-1">{change.path}</code>
        <span className="text-[11px] tabular-nums text-green-600">+{stats.add}</span>
        <span className="text-[11px] tabular-nums text-red-600">-{stats.del}</span>
        {change.needsHumanDecision && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            要判断
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="px-3 py-2 space-y-1">
            <p className="text-[11px] text-gray-600">理由: {change.reason}</p>
            {change.note && <p className="text-[11px] text-gray-600">補足: {change.note}</p>}
            {change.lostSegments.length > 0 && (
              <div className="text-[11px] text-red-700">
                <p className="font-bold">保持されなかった一次体験:</p>
                <ul className="list-disc pl-4">
                  {change.lostSegments.map((s, i) => (
                    <li key={i}>{s.slice(0, 80)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {(["diff", "after"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`text-[11px] px-2 py-0.5 rounded border ${
                    mode === m
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {m === "diff" ? "差分" : "変更後 全文"}
                </button>
              ))}
            </div>
          </div>

          <pre className="max-h-96 overflow-auto text-[11px] leading-relaxed font-mono border-t border-gray-100 bg-gray-50">
            {mode === "after"
              ? change.after.split("\n").map((t, i) => (
                  <div key={i} className="px-3 whitespace-pre-wrap break-words">
                    {t || " "}
                  </div>
                ))
              : lines.map((l, i) => (
                  <div
                    key={i}
                    className={`px-3 whitespace-pre-wrap break-words ${
                      l.kind === "add"
                        ? "bg-green-50 text-green-900"
                        : l.kind === "del"
                          ? "bg-red-50 text-red-900"
                          : l.kind === "gap"
                            ? "text-gray-300 text-center"
                            : "text-gray-600"
                    }`}
                  >
                    {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : l.kind === "gap" ? "" : "  "}
                    {l.text || " "}
                  </div>
                ))}
          </pre>
        </div>
      )}
    </div>
  );
}
