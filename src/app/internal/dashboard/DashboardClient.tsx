"use client";

import { useEffect, useState } from "react";

// ── Types ──

type AspProgram = { name: string; key: string; status: string };
type Asp = { name: string; status: string; updatedAt: string; programs: AspProgram[] };
type CtaEntry = { name: string; url: string; cta_text: string; asp: string; affiliate?: boolean };
type Keyword = { keyword: string; category: string; priority: string; status: string };
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

type GSCData = {
  configured: boolean;
  error?: string;
  stale?: boolean;
  latestDate?: string;
  daysSinceLatest?: number;
  totalClicks?: number;
  totalImpressions?: number;
  avgCtr?: string;
  avgPosition?: string;
  topQueries?: TopQuery[];
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
};

type TabId = "performance" | "site" | "asp" | "cta";

const TABS: { id: TabId; label: string }[] = [
  { id: "performance", label: "パフォーマンス" },
  { id: "site", label: "サイト管理" },
  { id: "asp", label: "ASP管理" },
  { id: "cta", label: "CTA Registry" },
];

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

// ── Performance Tab ──

function PerformanceTab({ ga4, gsc }: { ga4: GA4Data; gsc: GSCData }) {
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

      {/* GSC */}
      <Card title="Search Console（スプレッドシート経由）">
        {!gsc.configured ? (
          <Unconfigured message={gsc.error || "スプレッドシート環境変数を設定してください"} vars={["GSC_SPREADSHEET_ID"]} />
        ) : gsc.error ? (
          <ErrorMsg message={gsc.error} />
        ) : (
          <>
            {gsc.stale && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 mb-4">
                <p className="text-xs text-yellow-800 font-bold">
                  データ更新が停止している可能性があります
                </p>
                <p className="text-[10px] text-yellow-700 mt-0.5">
                  最新データ: {gsc.latestDate}（{gsc.daysSinceLatest}日前）— Search Analytics for Sheets の Recurrent Requests を確認してください
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Metric label="クリック (7日)" value={gsc.totalClicks?.toLocaleString() || "0"} />
              <Metric label="表示回数 (7日)" value={gsc.totalImpressions?.toLocaleString() || "0"} />
              <Metric label="平均CTR" value={`${gsc.avgCtr || 0}%`} />
              <Metric label="平均順位" value={gsc.avgPosition || "-"} />
            </div>
            {gsc.topQueries && gsc.topQueries.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">上位クエリ（7日間）</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left py-1.5 text-gray-500 font-medium text-xs">クエリ</th><th className="text-right py-1.5 text-gray-500 font-medium text-xs">クリック</th></tr></thead>
                  <tbody>
                    {gsc.topQueries.map((q, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 text-xs">
                          <a href={`https://www.google.com/search?q=${encodeURIComponent(q.query)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{q.query}</a>
                        </td>
                        <td className="py-1.5 text-right text-xs font-bold">{q.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
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
              <th className="text-left py-1.5 text-gray-500 font-medium text-xs">カテゴリ</th>
              <th className="text-left py-1.5 text-gray-500 font-medium text-xs">優先度</th>
            </tr></thead>
            <tbody>
              {keywords.map((k) => (
                <tr key={k.keyword} className="border-b border-gray-50">
                  <td className="py-1.5 text-xs">{k.keyword}</td>
                  <td className="py-1.5 text-xs text-gray-500">{k.category}</td>
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

function ErrorMsg({ message }: { message: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-xs text-red-700 break-all">{message}</p></div>;
}
