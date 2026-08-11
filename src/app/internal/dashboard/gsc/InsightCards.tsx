"use client";

import type { SCRow, SurgingPage, NewlyVisible } from "@/types/search-console";

function PageLink({ url }: { url: string }) {
  let path = url;
  let slug = "";
  try {
    path = new URL(url).pathname;
    const m = path.match(/\/articles\/(.+)/);
    if (m) slug = m[1];
  } catch { /* keep */ }
  return (
    <div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">{path}</a>
      {slug && <div className="text-[10px] text-gray-400 mt-0.5 select-all">content/articles/{slug}.md</div>}
    </div>
  );
}

function PriorityLabel({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${styles[priority]}`}>{labels[priority]}</span>;
}

export function RewriteCandidates({ items }: { items: (SCRow & { priority: "high" | "medium" | "low" })[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="text-[10px] text-gray-500 font-bold mb-1">リライト候補（順位11〜20位・表示10回以上）</p>
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-500 font-medium text-xs w-10">優先</th>
            <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs">順位</th>
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs">表示</th>
          </tr></thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2"><PriorityLabel priority={p.priority} /></td>
                <td className="py-2"><PageLink url={p.keys[0]} /></td>
                <td className="py-2 text-right text-xs">{p.position.toFixed(1)}</td>
                <td className="py-2 text-right text-xs">{p.impressions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function LowCtrPages({ items }: { items: (SCRow & { priority: "high" | "medium" | "low" })[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="text-[10px] text-gray-500 font-bold mb-1">CTR改善候補（順位1〜20位・CTR 2%未満）</p>
      <p className="text-[10px] text-gray-400 mb-2">タイトルやディスクリプション改善の余地がある可能性があります</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-500 font-medium text-xs w-10">優先</th>
            <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs">CTR</th>
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs">表示</th>
            <th className="text-right py-1.5 text-gray-500 font-medium text-xs">順位</th>
          </tr></thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2"><PriorityLabel priority={p.priority} /></td>
                <td className="py-2"><PageLink url={p.keys[0]} /></td>
                <td className="py-2 text-right text-xs">{(p.ctr * 100).toFixed(1)}%</td>
                <td className="py-2 text-right text-xs">{p.impressions}</td>
                <td className="py-2 text-right text-xs">{p.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SurgingPagesTable({ items }: { items: SurgingPage[] }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">今週</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">前週</th>
          <th className="text-right py-1.5 text-gray-500 font-medium text-xs">変化</th>
        </tr></thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-2"><PageLink url={p.page} /></td>
              <td className="py-2 text-right text-xs font-bold">{p.current}</td>
              <td className="py-2 text-right text-xs">{p.previous}</td>
              <td className="py-2 text-right text-xs text-green-600">{p.isNew ? "新規表示" : `+${p.changePercent.toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NewlyVisibleList({ items }: { items: NewlyVisible[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="text-[10px] text-gray-400 mb-2">前28日間の表示が0で、直近7日間に表示が発生。検索結果に表示され始めた可能性があります</p>
      <ul className="space-y-2">
        {items.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <PageLink url={p.page} />
            <span className="text-xs text-gray-500">表示 {p.impressions}回</span>
          </li>
        ))}
      </ul>
    </>
  );
}
