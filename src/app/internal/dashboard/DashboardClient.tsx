"use client";

import { useEffect, useState } from "react";

type AspProgram = { name: string; key: string; status: string };
type Asp = { name: string; status: string; updatedAt: string; programs: AspProgram[] };
type CtaEntry = { name: string; url: string; cta_text: string; asp: string; affiliate?: boolean };
type Keyword = { keyword: string; category: string; priority: string; status: string };
type ScheduledArticle = { slug: string; scheduled_publish: string; status: string };
type ReviewArticle = { slug: string; lastReviewDate: string };

type DashboardData = {
  asp: { asps: Asp[] } | null;
  site: {
    publishedCount: number;
    draftCount: number;
    totalArticles: number;
    scheduled: ScheduledArticle[];
    reviewDue: ReviewArticle[];
  };
  cta: Record<string, CtaEntry> | null;
  keywords: Keyword[];
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  not_registered: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "承認",
  pending: "審査中",
  rejected: "却下",
  not_registered: "未登録",
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/internal/api")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">NARU Internal Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">内部管理用ポータル（非公開）</p>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ASP管理 */}
        <Section title="ASP管理">
          {data.asp?.asps.map((asp) => (
            <div key={asp.name} className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{asp.name}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={asp.status} />
                  <span className="text-xs text-gray-400">更新: {asp.updatedAt}</span>
                </div>
              </div>
              {asp.programs.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">案件名</th>
                      <th className="text-left py-2 text-gray-500 font-medium">キー</th>
                      <th className="text-left py-2 text-gray-500 font-medium">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asp.programs.map((p) => (
                      <tr key={p.key} className="border-b border-gray-50">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 font-mono text-xs text-gray-500">{p.key}</td>
                        <td className="py-2"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400">登録案件なし</p>
              )}
            </div>
          ))}
        </Section>

        {/* サイト管理 */}
        <Section title="サイト管理">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="公開済み記事" value={data.site.publishedCount} />
            <StatCard label="全記事数" value={data.site.totalArticles} />
            <StatCard label="レビュー要" value={data.site.reviewDue.length} alert={data.site.reviewDue.length > 0} />
          </div>

          {/* 公開予定 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h3 className="font-bold text-gray-900 mb-3">直近7日間の公開予定</h3>
            {data.site.scheduled.length > 0 ? (
              <ul className="space-y-2">
                {data.site.scheduled.map((a) => (
                  <li key={a.slug} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{a.scheduled_publish}</span>
                    <span className="text-gray-700">{a.slug}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">直近7日間に公開予定の記事はありません</p>
            )}
          </div>

          {/* レビュー対象 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h3 className="font-bold text-gray-900 mb-3">レビュー対象記事（6ヶ月以上未更新）</h3>
            {data.site.reviewDue.length > 0 ? (
              <ul className="space-y-1">
                {data.site.reviewDue.map((a) => (
                  <li key={a.slug} className="text-sm text-gray-700">
                    {a.slug} <span className="text-gray-400">（前回: {a.lastReviewDate}）</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-green-600">すべて最新です</p>
            )}
          </div>

          {/* 未着手キーワード */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">未着手キーワード</h3>
            {data.keywords.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">キーワード</th>
                    <th className="text-left py-2 text-gray-500 font-medium">カテゴリ</th>
                    <th className="text-left py-2 text-gray-500 font-medium">優先度</th>
                    <th className="text-left py-2 text-gray-500 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {data.keywords.map((k) => (
                    <tr key={k.keyword} className="border-b border-gray-50">
                      <td className="py-2">{k.keyword}</td>
                      <td className="py-2 text-gray-500">{k.category}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${k.priority === "high" ? "bg-red-50 text-red-700" : k.priority === "medium" ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-600"}`}>
                          {k.priority}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">{k.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-green-600">未着手キーワードなし</p>
            )}
          </div>
        </Section>

        {/* CTA Registry */}
        <Section title="CTA Registry">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">キー</th>
                  <th className="text-left py-2 text-gray-500 font-medium">サービス名</th>
                  <th className="text-left py-2 text-gray-500 font-medium">ASP</th>
                  <th className="text-left py-2 text-gray-500 font-medium">affiliate</th>
                  <th className="text-left py-2 text-gray-500 font-medium">URL</th>
                </tr>
              </thead>
              <tbody>
                {data.cta && Object.entries(data.cta).map(([key, entry]) => (
                  <tr key={key} className={`border-b border-gray-50 ${!entry.url ? "bg-red-50/50" : ""}`}>
                    <td className="py-2 font-mono text-xs">{key}</td>
                    <td className="py-2">{entry.name}</td>
                    <td className="py-2 text-gray-500">{entry.asp || "-"}</td>
                    <td className="py-2">
                      {entry.affiliate === false ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">なし</span>
                      ) : (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">あり</span>
                      )}
                    </td>
                    <td className="py-2">
                      {entry.url ? (
                        <span className="text-xs text-green-600">設定済み</span>
                      ) : (
                        <span className="text-xs font-bold text-red-600">未設定</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </main>

      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        NARU Internal Dashboard — このページは非公開です
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] || status;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 text-center ${alert ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
