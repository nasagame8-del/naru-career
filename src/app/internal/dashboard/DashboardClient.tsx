"use client";

import { useEffect, useState } from "react";

// ── Types ──

type AspProgram = { name: string; key: string; status: string };
type Asp = { name: string; status: string; updatedAt: string; programs: AspProgram[] };
type CtaEntry = { name: string; url: string; cta_text: string; asp: string; affiliate?: boolean };
type Keyword = { keyword: string; category?: string; priority: string; status: string; cluster?: string };
type ScheduledArticle = { slug: string; scheduled_publish: string; status: string };
type ReviewArticle = { slug: string; lastReviewDate: string };
type TopPage = { path: string; views: number };
type TopQuery = { query: string; clicks: number };

type GA4Data = {
  configured: boolean;
  error?: string;
  users7d?: number; pv7d?: number; users28d?: number; pv28d?: number;
  topPages?: TopPage[];
};

type SCRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
type SCPeriod = { clicks: number; impressions: number; ctr: number; position: number; topQueries: SCRow[]; topPages: SCRow[]; pageQueries: SCRow[] };
type SurgingPage = { page: string; current: number; previous: number; changePercent: number; isNew: boolean };
type NewlyVisible = { page: string; impressions: number };

type QuerySuggestion =
  | { type: "title_improve"; label: string }
  | { type: "content_strengthen"; label: string }
  | { type: "growing"; label: string }
  | { type: "new_query"; label: string }
  | { type: "high_rank_low_volume"; label: string };

type QueryInsight = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pages: { page: string; clicks: number; impressions: number; position: number }[];
  prevPosition: number | null;
  positionChange: number | null;
  prevImpressions: number | null;
  impressionChange: number | null;
  suggestion: QuerySuggestion | null;
};

type EnhancedActionItem = {
  page: string;
  slug: string;
  priority: "high" | "medium" | "low";
  reasons: string[];
  suggestions: string[];
  topQueries: { query: string; position: number; impressions: number; ctr: number }[];
};

type ThemeStat = {
  id: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  queryCount: number;
};

type GSCData = {
  configured: boolean;
  error?: string;
  current7d?: SCPeriod;
  previous7d?: SCPeriod;
  current28d?: SCPeriod;
  previous28d?: SCPeriod;
  rewriteCandidates?: (SCRow & { priority: "high" | "medium" | "low" })[];
  lowCtrPages?: (SCRow & { priority: "high" | "medium" | "low" })[];
  surgingPages?: SurgingPage[];
  newlyVisible?: NewlyVisible[];
  actionItems?: string[];
  queryInsights?: QueryInsight[];
  enhancedActionItems?: EnhancedActionItem[];
  themeStats?: ThemeStat[];
};

type DashboardData = {
  summary: {
    articles: number; scheduled: number; reviewDue: number;
    ctaMissing: number; aspApproved: number; aspPending: number; keywords: number;
  };
  asp: { asps: Asp[] } | null;
  site: { publishedCount: number; totalArticles: number; scheduled: ScheduledArticle[]; reviewDue: ReviewArticle[] };
  cta: Record<string, CtaEntry> | null;
  keywords: Keyword[];
  ga4: GA4Data;
  gsc: GSCData;
  aioChecklist: AIOCheckItem[];
  internalLinks: { slug: string; outgoing: number; incoming: number }[];
};

type AIOCheckItem = {
  slug: string;
  title: string;
  checks: {
    person: boolean;
    faq: boolean;
    experience: boolean;
    comparisonTable: boolean;
    authoritativeSource: boolean;
    image: boolean;
    updateHistory: boolean;
  };
};

type TabId = "performance" | "site" | "asp" | "cta" | "aio";

const TABS: { id: TabId; label: string }[] = [
  { id: "performance", label: "パフォーマンス" },
  { id: "site", label: "サイト管理" },
  { id: "aio", label: "AIOチェック" },
  { id: "asp", label: "ASP管理" },
  { id: "cta", label: "CTA Registry" },
];

// ── 優先度バッジ ──
const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};
const PRIORITY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

function PriorityLabel({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function PageLink({ url }: { url: string }) {
  let path = url;
  let slug = "";
  try {
    path = new URL(url).pathname;
    const m = path.match(/\/articles\/(.+)/);
    if (m) slug = m[1];
  } catch { /* keep as-is */ }
  return (
    <div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">{path}</a>
      {slug && <div className="text-[10px] text-gray-400 mt-0.5 select-all">content/articles/{slug}.md</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  not_registered: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  approved: "承認", pending: "審査中", rejected: "却下", not_registered: "未登録",
};

// ── Main ──

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("performance");

  useEffect(() => {
    fetch("/internal/api").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!data) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">Failed to load</p></div>;

  const s = data.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">NARU Dashboard</h1>
            <p className="text-xs text-gray-400">Internal</p>
          </div>
          <span className="text-xs text-gray-400">{new Date().toLocaleDateString("ja-JP")}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <KPI label="記事数" value={s.articles} />
          <KPI label="公開予定" value={s.scheduled} color={s.scheduled > 0 ? "blue" : undefined} />
          <KPI label="レビュー要" value={s.reviewDue} color={s.reviewDue > 0 ? "red" : undefined} />
          <KPI label="未着手KW" value={s.keywords} color={s.keywords > 0 ? "yellow" : undefined} />
          <KPI label="CTA未設定" value={s.ctaMissing} color={s.ctaMissing > 0 ? "red" : undefined} />
          <KPI label="ASP承認" value={s.aspApproved} color="green" />
          <KPI label="ASP審査中" value={s.aspPending} color={s.aspPending > 0 ? "yellow" : undefined} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 mb-6">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                tab === t.id ? "text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === "performance" && <PerformanceTab ga4={data.ga4} gsc={data.gsc} />}
        {tab === "site" && <SiteTab site={data.site} keywords={data.keywords} />}
        {tab === "asp" && <AspTab asps={data.asp?.asps || []} />}
        {tab === "cta" && <CtaTab cta={data.cta} />}
        {tab === "aio" && (
          <>
            <AIOCheckTab items={data.aioChecklist || []} />
            <InternalLinksSection links={data.internalLinks || []} />
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 py-3 text-center text-[10px] text-gray-400">
        NARU Internal — 非公開
      </footer>
    </div>
  );
}

// ── KPI Card ──

function KPI({ label, value, color }: { label: string; value: number; color?: "red" | "blue" | "yellow" | "green" }) {
  const colors = {
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
    green: "border-green-200 bg-green-50 text-green-700",
  };
  const cls = color ? colors[color] : "border-gray-200 bg-white text-gray-900";
  return (
    <div className={`rounded-lg border p-3 text-center ${cls}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

// ── Collapsible Section ──

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-700">
        <span className="text-[10px]">{open ? "▼" : "▶"}</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

// ── Suggestion Badge ──

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

// ── Sortable Column Header ──

function SortHeader({ label, sortKey, currentKey, asc, onSort }: { label: string; sortKey: string; currentKey: string; asc: boolean; onSort: (key: string) => void }) {
  const active = sortKey === currentKey;
  return (
    <th
      className="text-right py-1.5 text-gray-500 font-medium text-xs cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}{active ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ── Performance Tab ──

function PerformanceTab({ ga4, gsc }: { ga4: GA4Data; gsc: GSCData }) {
  const [querySortKey, setQuerySortKey] = useState<string>("impressions");
  const [querySortAsc, setQuerySortAsc] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [queryShowAll, setQueryShowAll] = useState(false);

  const handleQuerySort = (key: string) => {
    if (querySortKey === key) {
      setQuerySortAsc(!querySortAsc);
    } else {
      setQuerySortKey(key);
      setQuerySortAsc(false);
    }
  };

  // Sort query insights
  const sortedInsights = [...(gsc.queryInsights || [])].sort((a, b) => {
    const getValue = (item: QueryInsight) => {
      switch (querySortKey) {
        case "clicks": return item.clicks;
        case "impressions": return item.impressions;
        case "ctr": return item.ctr;
        case "position": return item.position;
        case "positionChange": return item.positionChange ?? 999;
        default: return item.impressions;
      }
    };
    const va = getValue(a);
    const vb = getValue(b);
    return querySortAsc ? va - vb : vb - va;
  });

  // Build page→queries map from pageQueries for expanded page view
  const pageQueriesMap = new Map<string, SCRow[]>();
  if (gsc.current7d?.pageQueries) {
    for (const row of gsc.current7d.pageQueries) {
      const page = row.keys[0];
      if (!pageQueriesMap.has(page)) pageQueriesMap.set(page, []);
      pageQueriesMap.get(page)!.push(row);
    }
  }

  return (
    <div className="space-y-6">
      {/* GA4 */}
      <Card title="GA4 アナリティクス">
        {!ga4.configured ? (
          <Unconfigured message={ga4.error || "GA4環境変数を設定してください"} vars={["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"]} />
        ) : ga4.error ? (
          <ErrorMsg message={ga4.error} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Metric label="ユーザー (7日)" value={ga4.users7d?.toLocaleString() || "0"} />
              <Metric label="PV (7日)" value={ga4.pv7d?.toLocaleString() || "0"} />
              <Metric label="ユーザー (28日)" value={ga4.users28d?.toLocaleString() || "0"} />
              <Metric label="PV (28日)" value={ga4.pv28d?.toLocaleString() || "0"} />
            </div>
            {ga4.topPages && ga4.topPages.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">人気ページ（7日間）</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left py-1.5 text-gray-500 font-medium text-xs">パス</th><th className="text-right py-1.5 text-gray-500 font-medium text-xs">PV</th></tr></thead>
                  <tbody>
                    {ga4.topPages.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 text-xs font-mono">
                          <a href={`https://naru-career.com${p.path}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{p.path}</a>
                        </td>
                        <td className="py-1.5 text-right text-xs font-bold">{p.views.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Card>

      {/* GSC — Search Console API直接取得 */}
      <Card title="Search Console">
        {!gsc.configured ? (
          <Unconfigured message={gsc.error || "Search Console環境変数を設定してください"} vars={["SEARCH_CONSOLE_SITE_URL", "GOOGLE_SERVICE_ACCOUNT_EMAIL"]} />
        ) : gsc.error ? (
          <ErrorMsg message={gsc.error} />
        ) : (
          <>
            {/* Disclaimer */}
            <p className="text-[10px] text-gray-400 mb-4">
              Search Console APIの数値はGoogle Search Consoleの仕様上、すべての検索クエリ・行を完全に取得できない場合があります。改善判断の参考値として利用してください。
            </p>

            {/* サマリー（7日間） */}
            {gsc.current7d && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Metric label="クリック (7日)" value={gsc.current7d.clicks.toLocaleString()} />
                <Metric label="表示回数 (7日)" value={gsc.current7d.impressions.toLocaleString()} />
                <Metric label="平均CTR" value={`${(gsc.current7d.ctr * 100).toFixed(1)}%`} />
                <Metric label="平均順位" value={gsc.current7d.position.toFixed(1)} />
              </div>
            )}

            {/* 前週比 */}
            {gsc.current7d && gsc.previous7d && gsc.previous7d.impressions > 0 && (
              <div className="text-[10px] text-gray-500 mb-4">
                前週比: クリック {gsc.previous7d.clicks > 0 ? `${(((gsc.current7d.clicks - gsc.previous7d.clicks) / gsc.previous7d.clicks) * 100).toFixed(0)}%` : "N/A"} / 表示 {`${(((gsc.current7d.impressions - gsc.previous7d.impressions) / gsc.previous7d.impressions) * 100).toFixed(0)}%`}
              </div>
            )}

            {/* 今週やること (Enhanced) */}
            {gsc.enhancedActionItems && gsc.enhancedActionItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <h4 className="text-xs font-bold text-blue-800 mb-3">今週やること</h4>
                <div className="space-y-3">
                  {gsc.enhancedActionItems.map((item, i) => {
                    let pagePath = item.page;
                    try { pagePath = new URL(item.page).pathname; } catch { /* keep as-is */ }
                    return (
                      <div key={i} className="bg-white/60 rounded px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityLabel priority={item.priority} />
                          <a href={item.page} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline font-medium">{pagePath}</a>
                        </div>
                        {item.slug && <div className="text-[10px] text-gray-400 mb-1 select-all">content/articles/{item.slug}.md</div>}
                        <ul className="space-y-0.5 mb-1">
                          {item.reasons.map((r, ri) => (
                            <li key={ri} className="text-[11px] text-blue-700">- {r}</li>
                          ))}
                        </ul>
                        <ul className="space-y-0.5 mb-1">
                          {item.suggestions.map((s, si) => (
                            <li key={si} className="text-[10px] text-blue-600">→ {s}</li>
                          ))}
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
            )}

            {/* 検索クエリ (NEW) */}
            {sortedInsights.length > 0 && (
              <Collapsible title={`検索クエリ（${sortedInsights.length}件）`} defaultOpen={true}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 text-gray-500 font-medium text-xs">クエリ</th>
                      <SortHeader label="クリック" sortKey="clicks" currentKey={querySortKey} asc={querySortAsc} onSort={handleQuerySort} />
                      <SortHeader label="表示" sortKey="impressions" currentKey={querySortKey} asc={querySortAsc} onSort={handleQuerySort} />
                      <SortHeader label="CTR" sortKey="ctr" currentKey={querySortKey} asc={querySortAsc} onSort={handleQuerySort} />
                      <SortHeader label="順位" sortKey="position" currentKey={querySortKey} asc={querySortAsc} onSort={handleQuerySort} />
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs whitespace-nowrap">前週順位</th>
                      <SortHeader label="順位変化" sortKey="positionChange" currentKey={querySortKey} asc={querySortAsc} onSort={handleQuerySort} />
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs whitespace-nowrap">推奨</th>
                    </tr></thead>
                    <tbody>
                      {(queryShowAll ? sortedInsights : sortedInsights.slice(0, 30)).map((qi, i) => (
                        <>
                          <tr
                            key={`row-${i}`}
                            className={`border-b border-gray-50 hover:bg-gray-50 ${qi.pages.length > 0 ? "cursor-pointer" : ""}`}
                            onClick={() => qi.pages.length > 0 && setExpandedQuery(expandedQuery === qi.query ? null : qi.query)}
                          >
                            <td className="py-1.5 text-xs">
                              <div className="flex items-center gap-1">
                                {qi.pages.length > 0 && <span className="text-[10px] text-gray-400">{expandedQuery === qi.query ? "▼" : "▶"}</span>}
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
                          {expandedQuery === qi.query && qi.pages.length > 0 && (
                            <tr key={`expanded-${i}`}>
                              <td colSpan={8} className="bg-gray-50 px-4 py-2">
                                {qi.pages.length > 1 && (
                                  <p className="text-[10px] text-amber-600 font-bold mb-1">
                                    このクエリで{qi.pages.length}ページが表示されています。カニバリゼーションの可能性があります。
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
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedInsights.length > 30 && !queryShowAll && (
                  <button onClick={() => setQueryShowAll(true)} className="text-xs text-blue-600 hover:underline mt-2">
                    もっと見る（残り{sortedInsights.length - 30}件）
                  </button>
                )}
              </Collapsible>
            )}

            {/* 上位ページ (ENHANCED with accordion) */}
            {gsc.current7d?.topPages && gsc.current7d.topPages.length > 0 && (
              <Collapsible title={`上位ページ（${gsc.current7d.topPages.length}件）`} defaultOpen={true}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">クリック</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">表示</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">順位</th>
                    </tr></thead>
                    <tbody>
                      {gsc.current7d.topPages.map((p, i) => {
                        let pagePath = p.keys[0];
                        let slug = "";
                        try {
                          pagePath = new URL(p.keys[0]).pathname;
                          const m = pagePath.match(/\/articles\/(.+)/);
                          if (m) slug = m[1];
                        } catch { /* keep as-is */ }
                        const queries = pageQueriesMap.get(p.keys[0]) || [];
                        const isExpanded = expandedPage === p.keys[0];
                        return (
                          <>
                            <tr
                              key={`page-${i}`}
                              className={`border-b border-gray-50 hover:bg-gray-50 ${queries.length > 0 ? "cursor-pointer" : ""}`}
                              onClick={() => queries.length > 0 && setExpandedPage(isExpanded ? null : p.keys[0])}
                            >
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
                              <tr key={`pageq-${i}`}>
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
                                      {queries
                                        .sort((a, b) => b.impressions - a.impressions)
                                        .slice(0, 10)
                                        .map((q, qi) => (
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
                      })}
                    </tbody>
                  </table>
                </div>
              </Collapsible>
            )}

            {/* テーマ別 (NEW) */}
            {gsc.themeStats && gsc.themeStats.length > 0 && (
              <Collapsible title="テーマ別">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gsc.themeStats.map((theme) => (
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
              </Collapsible>
            )}

            {/* 改善候補 (ENHANCED - combining rewriteCandidates and lowCtrPages) */}
            {((gsc.rewriteCandidates && gsc.rewriteCandidates.length > 0) || (gsc.lowCtrPages && gsc.lowCtrPages.length > 0)) && (
              <Collapsible title="改善候補">
                {gsc.rewriteCandidates && gsc.rewriteCandidates.length > 0 && (
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
                          {gsc.rewriteCandidates.map((p, i) => (
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
                )}
                {gsc.lowCtrPages && gsc.lowCtrPages.length > 0 && (
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
                          {gsc.lowCtrPages.map((p, i) => (
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
                )}
              </Collapsible>
            )}

            {/* 表示急増 */}
            {gsc.surgingPages && gsc.surgingPages.length > 0 && (
              <Collapsible title={`表示急増（${gsc.surgingPages.length}件）`} defaultOpen={true}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ページ</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">今週</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">前週</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium text-xs">変化</th>
                    </tr></thead>
                    <tbody>
                      {gsc.surgingPages.map((p, i) => (
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
              </Collapsible>
            )}

            {/* 新規表示 */}
            {gsc.newlyVisible && gsc.newlyVisible.length > 0 && (
              <Collapsible title={`新規表示（${gsc.newlyVisible.length}件）`} defaultOpen={true}>
                <p className="text-[10px] text-gray-400 mb-2">前28日間の表示が0で、直近7日間に表示が発生。検索結果に表示され始めた可能性があります</p>
                <ul className="space-y-2">
                  {gsc.newlyVisible.map((p, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <PageLink url={p.page} />
                      <span className="text-xs text-gray-500">表示 {p.impressions}回</span>
                    </li>
                  ))}
                </ul>
              </Collapsible>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ── Site Tab ──

function SiteTab({ site, keywords }: { site: DashboardData["site"]; keywords: Keyword[] }) {
  return (
    <div className="space-y-4">
      <Card title="公開予定（7日以内）">
        {site.scheduled.length > 0 ? (
          <ul className="space-y-1.5">
            {site.scheduled.map((a) => (
              <li key={a.slug} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{a.scheduled_publish}</span>
                <a href={`https://naru-career.com/articles/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.slug}</a>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-400">なし</p>}
      </Card>

      <Card title="レビュー対象（6ヶ月以上未更新）">
        {site.reviewDue.length > 0 ? (
          <ul className="space-y-1">
            {site.reviewDue.map((a) => (
              <li key={a.slug} className="text-sm"><a href={`https://naru-career.com/articles/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.slug}</a> <span className="text-gray-400">（{a.lastReviewDate}）</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-green-600">すべて最新です</p>}
      </Card>

      <Card title="未着手キーワード">
        {keywords.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left py-1.5 text-gray-500 font-medium text-xs">キーワード</th>
              <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ステータス</th>
              <th className="text-left py-1.5 text-gray-500 font-medium text-xs">優先度</th>
            </tr></thead>
            <tbody>
              {keywords.map((k) => (
                <tr key={k.keyword} className="border-b border-gray-50">
                  <td className="py-1.5 text-xs">
                    {k.keyword}
                    {k.cluster && <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{k.cluster}</span>}
                  </td>
                  <td className="py-1.5 text-xs text-gray-500">{k.status}</td>
                  <td className="py-1.5"><PriorityBadge priority={k.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-green-600">なし</p>}
      </Card>
    </div>
  );
}

// ── ASP Tab ──

const ASP_URLS: Record<string, string> = {
  "A8.net": "https://www.a8.net/",
  "アクセストレード": "https://www.accesstrade.ne.jp/",
  "バリューコマース": "https://www.valuecommerce.ne.jp/",
  "afb": "https://www.afi-b.com/",
};

function AspTab({ asps }: { asps: Asp[] }) {
  return (
    <div className="space-y-4">
      {asps.map((asp) => (
        <Card key={asp.name} title={asp.name} badge={<StatusBadge status={asp.status} />} subtitle={`更新: ${asp.updatedAt}`}
          titleLink={ASP_URLS[asp.name]}>
          {asp.programs.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-500 font-medium text-xs">案件名</th>
                <th className="text-left py-1.5 text-gray-500 font-medium text-xs">キー</th>
                <th className="text-left py-1.5 text-gray-500 font-medium text-xs">状態</th>
              </tr></thead>
              <tbody>
                {asp.programs.map((p) => (
                  <tr key={p.key} className="border-b border-gray-50">
                    <td className="py-1.5 text-xs">{p.name}</td>
                    <td className="py-1.5 font-mono text-[10px] text-gray-400">{p.key}</td>
                    <td className="py-1.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-xs text-gray-400">案件なし</p>}
        </Card>
      ))}
    </div>
  );
}

// ── CTA Tab ──

function CtaTab({ cta }: { cta: Record<string, CtaEntry> | null }) {
  if (!cta) return <p className="text-sm text-gray-400">データなし</p>;
  return (
    <Card title="登録案件一覧">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">キー</th>
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">サービス名</th>
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">ASP</th>
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">affiliate</th>
          <th className="text-left py-1.5 text-gray-500 font-medium text-xs">URL</th>
        </tr></thead>
        <tbody>
          {Object.entries(cta).map(([key, e]) => (
            <tr key={key} className={`border-b border-gray-50 ${!e.url ? "bg-red-50/40" : ""}`}>
              <td className="py-1.5 font-mono text-[10px]">{key}</td>
              <td className="py-1.5 text-xs">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{e.name}</a> : e.name}</td>
              <td className="py-1.5 text-xs text-gray-500">{e.asp || "-"}</td>
              <td className="py-1.5">{e.affiliate === false ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">なし</span> : <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">あり</span>}</td>
              <td className="py-1.5">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline">設定済み ↗</a> : <span className="text-[10px] font-bold text-red-600">未設定</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── Shared Components ──

function Card({ title, badge, subtitle, titleLink, children }: { title: string; badge?: React.ReactNode; subtitle?: string; titleLink?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {titleLink ? (
            <a href={titleLink} target="_blank" rel="noopener noreferrer" className="font-bold text-sm text-blue-600 hover:underline">{title} ↗</a>
          ) : (
            <h3 className="font-bold text-sm text-gray-900">{title}</h3>
          )}
          {badge}
        </div>
        {subtitle && <span className="text-[10px] text-gray-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[status] || status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === "high" ? "bg-red-50 text-red-700" : priority === "medium" ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-600";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>{priority}</span>;
}

function Unconfigured({ message, vars }: { message: string; vars: string[] }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500 mb-2">{message}</p>
      <div className="text-[10px] text-gray-400 space-y-0.5">
        {vars.map((v) => <p key={v} className="font-mono">{v}</p>)}
      </div>
    </div>
  );
}

// ── Internal Links Section ──
function InternalLinksSection({ links }: { links: { slug: string; outgoing: number; incoming: number }[] }) {
  const candidates = links.filter((l) => l.outgoing < 2 || l.incoming < 2);
  const sorted = [...candidates].sort((a, b) => (a.outgoing + a.incoming) - (b.outgoing + b.incoming));

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-sm font-bold">内部リンク状況（リンク不足候補: {candidates.length}件）</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-2 py-1.5 font-medium">記事</th>
              <th className="px-2 py-1.5 font-medium text-center">出リンク</th>
              <th className="px-2 py-1.5 font-medium text-center">入リンク</th>
              <th className="px-2 py-1.5 font-medium text-center">状態</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.slug} className="border-b">
                <td className="px-2 py-1.5 font-mono text-[10px]">{l.slug}</td>
                <td className="text-center px-2 py-1.5">
                  <span className={l.outgoing < 2 ? "text-red-500 font-bold" : ""}>{l.outgoing}</span>
                </td>
                <td className="text-center px-2 py-1.5">
                  <span className={l.incoming < 2 ? "text-red-500 font-bold" : ""}>{l.incoming}</span>
                </td>
                <td className="text-center px-2 py-1.5">
                  {l.outgoing < 2 && l.incoming < 2
                    ? <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">要改善</span>
                    : <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">一部不足</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-xs text-red-700 break-all">{message}</p></div>;
}

// ── AIO Check Tab ──
const AIO_LABELS: { key: keyof AIOCheckItem["checks"]; label: string }[] = [
  { key: "person", label: "著者情報" },
  { key: "faq", label: "FAQ" },
  { key: "experience", label: "体験談" },
  { key: "comparisonTable", label: "比較表" },
  { key: "authoritativeSource", label: "権威ソース" },
  { key: "image", label: "画像" },
  { key: "updateHistory", label: "更新履歴" },
];

function AIOCheckTab({ items }: { items: AIOCheckItem[] }) {
  const [sortByMissing, setSortByMissing] = useState(false);

  const sorted = [...items].sort((a, b) => {
    if (!sortByMissing) return a.slug.localeCompare(b.slug);
    const countMissing = (c: AIOCheckItem["checks"]) =>
      AIO_LABELS.filter((l) => !c[l.key]).length;
    return countMissing(b.checks) - countMissing(a.checks);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">AIO観点チェックリスト（{items.length}記事）</h2>
        <button
          onClick={() => setSortByMissing(!sortByMissing)}
          className="text-[11px] px-2 py-1 border rounded hover:bg-gray-50"
        >
          {sortByMissing ? "slug順に戻す" : "×が多い順に並べる"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-2 py-1.5 font-medium">記事</th>
              {AIO_LABELS.map((l) => (
                <th key={l.key} className="px-1.5 py-1.5 font-medium text-center whitespace-nowrap">{l.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const missingCount = AIO_LABELS.filter((l) => !item.checks[l.key]).length;
              return (
                <tr key={item.slug} className={`border-b ${missingCount >= 3 ? "bg-red-50/50" : ""}`}>
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={item.title}>
                    <span className="font-mono text-[10px] text-gray-400">{item.slug}</span>
                  </td>
                  {AIO_LABELS.map((l) => (
                    <td key={l.key} className="text-center px-1.5 py-1.5">
                      {item.checks[l.key]
                        ? <span className="text-green-600">○</span>
                        : <span className="text-red-400">×</span>
                      }
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
