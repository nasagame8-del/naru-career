"use client";

import { useState } from "react";
import type { QueryInsight, QuerySuggestion } from "@/types/search-console";

const SUGGESTION_STYLES: Record<string, string> = {
  title_improve: "bg-amber-50 text-amber-700 border-amber-200",
  content_strengthen: "bg-blue-50 text-blue-700 border-blue-200",
  growing: "bg-green-50 text-green-700 border-green-200",
  new_query: "bg-purple-50 text-purple-700 border-purple-200",
  high_rank_low_volume: "bg-gray-100 text-gray-600 border-gray-200",
};
const SUGGESTION_SHORT: Record<string, string> = {
  title_improve: "タイトル改善",
  content_strengthen: "コンテンツ強化",
  growing: "成長中",
  new_query: "新規",
  high_rank_low_volume: "高順位低Vol",
};

function SuggestionBadge({ suggestion }: { suggestion: QuerySuggestion | null }) {
  if (!suggestion) return null;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${SUGGESTION_STYLES[suggestion.type] || ""}`} title={suggestion.label}>
      {SUGGESTION_SHORT[suggestion.type] || suggestion.type}
    </span>
  );
}

function SortHeader({ label, sortKey, currentKey, asc, onSort }: { label: string; sortKey: string; currentKey: string; asc: boolean; onSort: (key: string) => void }) {
  const active = sortKey === currentKey;
  return (
    <th className="text-right py-1.5 text-gray-500 font-medium text-xs cursor-pointer hover:text-gray-700 select-none whitespace-nowrap" onClick={() => onSort(sortKey)}>
      {label}{active ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

export function QueryTable({ insights }: { insights: QueryInsight[] }) {
  const [sortKey, setSortKey] = useState<string>("impressions");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...insights].sort((a, b) => {
    const getValue = (item: QueryInsight) => {
      switch (sortKey) {
        case "clicks": return item.clicks;
        case "impressions": return item.impressions;
        case "ctr": return item.ctr;
        case "position": return item.position;
        case "positionChange": return item.positionChange ?? 999;
        default: return item.impressions;
      }
    };
    return sortAsc ? getValue(a) - getValue(b) : getValue(b) - getValue(a);
  });

  const visible = showAll ? sorted : sorted.slice(0, 30);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-500 font-medium text-xs">クエリ</th>
            <SortHeader label="クリック" sortKey="clicks" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
            <SortHeader label="表示" sortKey="impressions" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
            <SortHeader label="CTR" sortKey="ctr" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
            <SortHeader label="順位" sortKey="position" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs whitespace-nowrap">前週順位</th>
            <SortHeader label="順位変化" sortKey="positionChange" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs whitespace-nowrap">推奨</th>
          </tr></thead>
          <tbody>
            {visible.map((qi, i) => (
              <QueryRow key={qi.query} qi={qi} expanded={expandedQuery === qi.query} onToggle={() => setExpandedQuery(expandedQuery === qi.query ? null : qi.query)} />
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 30 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-xs text-blue-600 hover:underline mt-2">
          もっと見る（残り{sorted.length - 30}件）
        </button>
      )}
    </>
  );
}

function QueryRow({ qi, expanded, onToggle }: { qi: QueryInsight; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`border-b border-gray-50 hover:bg-gray-50 ${qi.pages.length > 0 ? "cursor-pointer" : ""}`} onClick={() => qi.pages.length > 0 && onToggle()}>
        <td className="py-1.5 text-xs">
          <div className="flex items-center gap-1">
            {qi.pages.length > 0 && <span className="text-[10px] text-gray-400">{expanded ? "▼" : "▶"}</span>}
            <a href={`https://www.google.com/search?q=${encodeURIComponent(qi.query)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{qi.query}</a>
          </div>
        </td>
        <td className="py-1.5 text-right text-xs font-bold">{qi.clicks}</td>
        <td className="py-1.5 text-right text-xs">{qi.impressions}</td>
        <td className="py-1.5 text-right text-xs">{(qi.ctr * 100).toFixed(1)}%</td>
        <td className="py-1.5 text-right text-xs">{qi.position.toFixed(1)}</td>
        <td className="py-1.5 text-right text-xs text-gray-400">{qi.prevPosition !== null ? qi.prevPosition.toFixed(1) : "-"}</td>
        <td className="py-1.5 text-right text-xs">
          {qi.positionChange !== null ? (
            <span className={qi.positionChange < 0 ? "text-green-600" : qi.positionChange > 0 ? "text-red-500" : "text-gray-400"}>
              {qi.positionChange < 0 ? `${qi.positionChange.toFixed(1)}` : qi.positionChange > 0 ? `+${qi.positionChange.toFixed(1)}` : "0"}
            </span>
          ) : "-"}
        </td>
        <td className="py-1.5 text-right"><SuggestionBadge suggestion={qi.suggestion} /></td>
      </tr>
      {expanded && qi.pages.length > 0 && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-4 py-2">
            {qi.pages.length > 1 && (
              <p className="text-[10px] text-amber-600 font-bold mb-1">
                同一クエリで{qi.pages.length}ページが表示されています。検索意図の重複がないか確認候補です
              </p>
            )}
            <table className="w-full text-[11px]">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left py-1 text-gray-500">ページ</th>
                <th className="text-right py-1 text-gray-500">クリック</th>
                <th className="text-right py-1 text-gray-500">表示</th>
                <th className="text-right py-1 text-gray-500">順位</th>
              </tr></thead>
              <tbody>
                {qi.pages.map((p, pi) => {
                  let pPath = p.page;
                  try { pPath = new URL(p.page).pathname; } catch { /* keep */ }
                  return (
                    <tr key={pi} className="border-b border-gray-100">
                      <td className="py-1"><a href={p.page} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{pPath}</a></td>
                      <td className="py-1 text-right">{p.clicks}</td>
                      <td className="py-1 text-right">{p.impressions}</td>
                      <td className="py-1 text-right">{p.position.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
