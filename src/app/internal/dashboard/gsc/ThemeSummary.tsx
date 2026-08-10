"use client";

import type { ThemeStat } from "@/types/search-console";

export function ThemeSummary({ stats }: { stats: ThemeStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map((theme) => (
        <div key={theme.id} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-700 mb-1">{theme.label}</p>
          <div className="space-y-0.5 text-[10px] text-gray-500">
            <p>表示: {theme.impressions.toLocaleString()}</p>
            <p>クリック: {theme.clicks.toLocaleString()}</p>
            <p>CTR: {(theme.ctr * 100).toFixed(1)}%</p>
            <p>平均順位: {theme.avgPosition.toFixed(1)}</p>
            <p>クエリ数: {theme.queryCount}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
