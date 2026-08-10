"use client";

import { useState } from "react";
import type { SCRow } from "@/types/search-console";

export function PagePerformanceTable({ pages, pageQueries }: { pages: SCRow[]; pageQueries: SCRow[] }) {
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  const pageQueriesMap = new Map<string, SCRow[]>();
  for (const row of pageQueries) {
    const page = row.keys[0];
    if (!pageQueriesMap.has(page)) pageQueriesMap.set(page, []);
    pageQueriesMap.get(page)!.push(row);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">クリック</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">表示</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">順位</th>
        </tr></thead>
        <tbody>
          {pages.map((p, i) => {
            let pagePath = p.keys[0];
            let slug = "";
            try {
              pagePath = new URL(p.keys[0]).pathname;
              const m = pagePath.match(/\/articles\/(.+)/);
              if (m) slug = m[1];
            } catch { /* keep */ }
            const queries = pageQueriesMap.get(p.keys[0]) || [];
            const isExpanded = expandedPage === p.keys[0];
            return (
              <PageRow key={p.keys[0]} p={p} pagePath={pagePath} slug={slug} queries={queries} isExpanded={isExpanded}
                onToggle={() => setExpandedPage(isExpanded ? null : p.keys[0])} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PageRow({ p, pagePath, slug, queries, isExpanded, onToggle }: {
  p: SCRow; pagePath: string; slug: string; queries: SCRow[]; isExpanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <tr className={`border-b border-gray-50 hover:bg-gray-50 ${queries.length > 0 ? "cursor-pointer" : ""}`}
        onClick={() => queries.length > 0 && onToggle()}>
        <td className="py-1.5 text-xs">
          <div className="flex items-center gap-1">
            {queries.length > 0 && <span className="text-[10px] text-gray-400">{isExpanded ? "▼" : "▶"}</span>}
            <div>
              <a href={p.keys[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{pagePath}</a>
              {slug && <div className="text-[10px] text-gray-400 mt-0.5 select-all">content/articles/{slug}.md</div>}
            </div>
          </div>
        </td>
        <td className="py-1.5 text-right text-xs font-bold">{p.clicks}</td>
        <td className="py-1.5 text-right text-xs">{p.impressions}</td>
        <td className="py-1.5 text-right text-xs">{p.position.toFixed(1)}</td>
      </tr>
      {isExpanded && queries.length > 0 && (
        <tr>
          <td colSpan={4} className="bg-gray-50 px-4 py-2">
            <p className="text-[10px] text-gray-500 mb-1 font-bold">このページの上位クエリ（最大10件）</p>
            <table className="w-full text-[11px]">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left py-1 text-gray-500">クエリ</th>
                <th className="text-right py-1 text-gray-500">クリック</th>
                <th className="text-right py-1 text-gray-500">表示</th>
                <th className="text-right py-1 text-gray-500">順位</th>
              </tr></thead>
              <tbody>
                {queries.sort((a, b) => b.impressions - a.impressions).slice(0, 10).map((q, qi) => (
                  <tr key={qi} className="border-b border-gray-100">
                    <td className="py-1"><a href={`https://www.google.com/search?q=${encodeURIComponent(q.keys[1])}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{q.keys[1]}</a></td>
                    <td className="py-1 text-right">{q.clicks}</td>
                    <td className="py-1 text-right">{q.impressions}</td>
                    <td className="py-1 text-right">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
