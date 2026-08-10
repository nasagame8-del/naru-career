"use client";

import type { EnhancedActionItem } from "@/types/search-console";

function PriorityLabel({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${styles[priority]}`}>
      {labels[priority]}
    </span>
  );
}

export function WeeklyActions({ items }: { items: EnhancedActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
      <h4 className="text-xs font-bold text-blue-800 mb-3">今週やること</h4>
      <div className="space-y-3">
        {items.map((item, i) => {
          let pagePath = item.page;
          try { pagePath = new URL(item.page).pathname; } catch { /* keep */ }
          return (
            <div key={i} className="bg-white/60 rounded px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <PriorityLabel priority={item.priority} />
                <a href={item.page} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline font-medium">{pagePath}</a>
              </div>
              {item.slug && <div className="text-[10px] text-gray-400 mb-1 select-all">content/articles/{item.slug}.md</div>}
              <ul className="space-y-0.5 mb-1">
                {item.reasons.map((r, ri) => <li key={ri} className="text-[11px] text-blue-700">- {r}</li>)}
              </ul>
              <ul className="space-y-0.5 mb-1">
                {item.suggestions.map((s, si) => <li key={si} className="text-[10px] text-blue-600">→ {s}</li>)}
              </ul>
              {item.topQueries.length > 0 && (
                <div className="text-[10px] text-gray-500 mt-1">
                  関連クエリ: {item.topQueries.map((tq) => `${tq.query} (${tq.position.toFixed(0)}位)`).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
