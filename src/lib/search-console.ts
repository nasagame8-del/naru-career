/**
 * Google Search Console API 直接取得
 *
 * 環境変数:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   SEARCH_CONSOLE_SITE_URL (例: sc-domain:naru-career.com)
 */

import { classifyQuery, QUERY_THEMES } from "./query-themes";

// ── 型定義 ──

export interface SCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SCPeriodData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: SCRow[];
  topPages: SCRow[];
  pageQueries: SCRow[];
}

export type QuerySuggestion =
  | { type: "title_improve"; label: string }
  | { type: "content_strengthen"; label: string }
  | { type: "growing"; label: string }
  | { type: "new_query"; label: string }
  | { type: "high_rank_low_volume"; label: string };

export interface QueryInsight {
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
}

export interface EnhancedActionItem {
  page: string;
  slug: string;
  priority: "high" | "medium" | "low";
  reasons: string[];
  suggestions: string[];
  topQueries: { query: string; position: number; impressions: number; ctr: number }[];
}

export interface ThemeStat {
  id: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  queryCount: number;
}

export interface SCData {
  configured: boolean;
  error?: string;
  current7d?: SCPeriodData;
  previous7d?: SCPeriodData;
  current28d?: SCPeriodData;
  previous28d?: SCPeriodData;
  // ダッシュボード用の導出データ
  rewriteCandidates?: (SCRow & { priority: "high" | "medium" | "low" })[];
  lowCtrPages?: (SCRow & { priority: "high" | "medium" | "low" })[];
  surgingPages?: { page: string; current: number; previous: number; changePercent: number; isNew: boolean }[];
  newlyVisible?: { page: string; impressions: number }[];
  actionItems?: string[];
  // v2: クエリインサイト
  queryInsights?: QueryInsight[];
  enhancedActionItems?: EnhancedActionItem[];
  themeStats?: ThemeStat[];
}

// ── 日付ヘルパー（太平洋時間を考慮） ──

function getPacificDate(offsetDays: number): string {
  const now = new Date();
  // UTC-7 (PDT) or UTC-8 (PST) — 簡易的にUTC-8で計算
  const pacific = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  pacific.setDate(pacific.getDate() + offsetDays);
  return pacific.toISOString().slice(0, 10);
}

// ── API呼び出し ──

async function querySearchConsole(
  auth: InstanceType<typeof import("googleapis").google.auth.JWT>,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number = 20
): Promise<SCRow[]> {
  const { google } = await import("googleapis");
  const webmasters = google.searchconsole({ version: "v1", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      dataState: "final",
    },
  });

  return (res.data.rows || []).map((r) => ({
    keys: r.keys || [],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

async function querySiteTotal(
  auth: InstanceType<typeof import("googleapis").google.auth.JWT>,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: number; impressions: number; ctr: number; position: number }> {
  const { google } = await import("googleapis");
  const webmasters = google.searchconsole({ version: "v1", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dataState: "final",
    },
  });

  const rows = res.data.rows || [];
  if (rows.length === 0) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  const r = rows[0];
  return {
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  };
}

async function fetchPeriod(
  auth: InstanceType<typeof import("googleapis").google.auth.JWT>,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<SCPeriodData> {
  const [total, topQueries, topPages, pageQueries] = await Promise.all([
    querySiteTotal(auth, siteUrl, startDate, endDate),
    querySearchConsole(auth, siteUrl, startDate, endDate, ["query"], 50),
    querySearchConsole(auth, siteUrl, startDate, endDate, ["page"], 20),
    querySearchConsole(auth, siteUrl, startDate, endDate, ["page", "query"], 100),
  ]);

  return { ...total, topQueries, topPages, pageQueries };
}

// ── 導出データの計算 ──

function deriveInsights(data: {
  current7d: SCPeriodData;
  previous7d: SCPeriodData;
  current28d: SCPeriodData;
  previous28d: SCPeriodData;
}): Pick<SCData, "rewriteCandidates" | "lowCtrPages" | "surgingPages" | "newlyVisible" | "actionItems"> {
  const { current7d, previous7d, current28d } = data;

  // リライト候補: 平均順位11〜20位、表示回数10回以上 + 優先度
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const rewriteCandidates = current28d.topPages
    .filter((p) => p.position >= 11 && p.position <= 20 && p.impressions >= 10)
    .map((p) => {
      const priority: "high" | "medium" | "low" =
        p.position <= 15 && p.impressions >= 20 ? "high"
        : p.position <= 20 && p.impressions >= 10 ? "medium"
        : "low";
      return { ...p, priority };
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // CTRが低い記事: 表示20回以上、順位1〜20位、CTR 2%未満 + 優先度
  const lowCtrPages = current28d.topPages
    .filter((p) => p.impressions >= 20 && p.position >= 1 && p.position <= 20 && p.ctr < 0.02)
    .map((p) => {
      const priority: "high" | "medium" | "low" =
        p.position <= 10 && p.ctr < 0.01 ? "high"
        : p.position <= 20 && p.ctr < 0.02 ? "medium"
        : "low";
      return { ...p, priority };
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // 表示急増記事
  const prevPageMap = new Map(previous7d.topPages.map((p) => [p.keys[0], p.impressions]));
  const surgingPages = current7d.topPages
    .filter((p) => p.impressions >= 10)
    .map((p) => {
      const prev = prevPageMap.get(p.keys[0]) || 0;
      const isNew = prev === 0;
      const changePercent = prev > 0 ? ((p.impressions - prev) / prev) * 100 : 100;
      return { page: p.keys[0], current: p.impressions, previous: prev, changePercent, isNew };
    })
    .filter((p) => p.isNew || p.changePercent >= 50);

  // 新規表示記事: 前28日間表示0、直近7日間表示1以上
  const prev28PageSet = new Set(data.previous28d.topPages.filter((p) => p.impressions > 0).map((p) => p.keys[0]));
  const newlyVisible = current7d.topPages
    .filter((p) => p.impressions >= 1 && !prev28PageSet.has(p.keys[0]))
    .map((p) => ({ page: p.keys[0], impressions: p.impressions }));

  // 今週やること（最大5件）
  const actionItems: string[] = [];
  for (const p of rewriteCandidates.slice(0, 2)) {
    const pagePath = new URL(p.keys[0]).pathname;
    actionItems.push(`${pagePath}（順位${p.position.toFixed(0)}位）→ 内容更新・内部リンク確認候補`);
  }
  for (const p of lowCtrPages.slice(0, 1)) {
    const pagePath = new URL(p.keys[0]).pathname;
    actionItems.push(`${pagePath}（CTR ${(p.ctr * 100).toFixed(1)}%）→ タイトル改善候補`);
  }
  for (const p of surgingPages.slice(0, 1)) {
    try {
      const pagePath = new URL(p.page).pathname;
      actionItems.push(`${pagePath}（表示${p.isNew ? "新規" : `+${p.changePercent.toFixed(0)}%`}）→ 関連記事・内部リンク追加候補`);
    } catch { /* invalid URL */ }
  }
  for (const p of newlyVisible.slice(0, 1)) {
    try {
      const pagePath = new URL(p.page).pathname;
      actionItems.push(`${pagePath} → 検索結果に表示され始めた可能性。経過観察`);
    } catch { /* invalid URL */ }
  }

  return {
    rewriteCandidates: rewriteCandidates.slice(0, 10),
    lowCtrPages: lowCtrPages.slice(0, 10),
    surgingPages: surgingPages.slice(0, 10),
    newlyVisible: newlyVisible.slice(0, 10),
    actionItems: actionItems.slice(0, 5),
  };
}

// ── クエリインサイト導出 ──

function deriveQueryInsights(data: {
  current7d: SCPeriodData;
  previous7d: SCPeriodData;
}): Pick<SCData, "queryInsights" | "enhancedActionItems" | "themeStats"> {
  const { current7d, previous7d } = data;

  // Build query→pages map from pageQueries
  const queryPagesMap = new Map<string, { page: string; clicks: number; impressions: number; position: number }[]>();
  for (const row of current7d.pageQueries) {
    const page = row.keys[0];
    const query = row.keys[1];
    if (!queryPagesMap.has(query)) queryPagesMap.set(query, []);
    queryPagesMap.get(query)!.push({ page, clicks: row.clicks, impressions: row.impressions, position: row.position });
  }

  // Build previous query map for comparison
  const prevQueryMap = new Map<string, SCRow>();
  for (const q of previous7d.topQueries) {
    prevQueryMap.set(q.keys[0], q);
  }

  // Build QueryInsight for each topQuery
  const queryInsights: QueryInsight[] = current7d.topQueries.map((q) => {
    const query = q.keys[0];
    const prev = prevQueryMap.get(query);
    const prevPosition = prev ? prev.position : null;
    const positionChange = prev ? q.position - prev.position : null;
    const prevImpressions = prev ? prev.impressions : null;
    const impressionChange = prev && prev.impressions > 0
      ? ((q.impressions - prev.impressions) / prev.impressions) * 100
      : null;
    const pages = queryPagesMap.get(query) || [];

    // Determine suggestion
    let suggestion: QuerySuggestion | null = null;
    if (prevImpressions === null || prevImpressions === 0) {
      if (q.impressions >= 1) {
        suggestion = { type: "new_query", label: "新しく表示され始めたクエリです" };
      }
    } else if (impressionChange !== null && impressionChange >= 50 && q.impressions >= 5) {
      suggestion = { type: "growing", label: "表示回数が急増しています。コンテンツ強化の好機です" };
    }
    if (!suggestion && q.position >= 1 && q.position <= 20 && q.impressions >= 10 && q.ctr < 0.02) {
      suggestion = { type: "title_improve", label: "順位に対してCTRが低い可能性があります。タイトル改善の余地があるかもしれません" };
    }
    if (!suggestion && q.position >= 11 && q.position <= 30 && q.impressions >= 10) {
      suggestion = { type: "content_strengthen", label: "もう少しで上位表示の可能性があります。コンテンツ充実が有効かもしれません" };
    }
    if (!suggestion && q.position >= 1 && q.position <= 5 && q.impressions < 5) {
      suggestion = { type: "high_rank_low_volume", label: "高順位ですが検索ボリュームが少ないクエリです" };
    }

    return {
      query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
      pages,
      prevPosition,
      positionChange,
      prevImpressions,
      impressionChange,
      suggestion,
    };
  });

  // Build themeStats
  const themeAgg = new Map<string, { impressions: number; clicks: number; totalPosition: number; count: number }>();
  for (const theme of QUERY_THEMES) {
    themeAgg.set(theme.id, { impressions: 0, clicks: 0, totalPosition: 0, count: 0 });
  }
  for (const qi of queryInsights) {
    const themeId = classifyQuery(qi.query);
    const agg = themeAgg.get(themeId)!;
    agg.impressions += qi.impressions;
    agg.clicks += qi.clicks;
    agg.totalPosition += qi.position;
    agg.count += 1;
  }
  const themeStats: ThemeStat[] = QUERY_THEMES
    .map((theme) => {
      const agg = themeAgg.get(theme.id)!;
      return {
        id: theme.id,
        label: theme.label,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        avgPosition: agg.count > 0 ? agg.totalPosition / agg.count : 0,
        queryCount: agg.count,
      };
    })
    .filter((t) => t.queryCount > 0);

  // Build enhancedActionItems: group insights by page
  const pageInsightMap = new Map<string, QueryInsight[]>();
  for (const qi of queryInsights) {
    for (const p of qi.pages) {
      if (!pageInsightMap.has(p.page)) pageInsightMap.set(p.page, []);
      pageInsightMap.get(p.page)!.push(qi);
    }
  }

  const enhancedItems: EnhancedActionItem[] = [];
  for (const [page, insights] of pageInsightMap) {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let priority: "high" | "medium" | "low" = "low";

    // Check for high: position 11-20, impressions >= 10
    const hasRewriteCandidate = insights.some((qi) => qi.position >= 11 && qi.position <= 20 && qi.impressions >= 10);
    if (hasRewriteCandidate) {
      priority = "high";
      reasons.push("順位11〜20位のクエリがあり、内容強化で上位表示の可能性があります");
      suggestions.push("記事内容の充実・最新情報の追加を検討してください");
    }

    // Check for medium: CTR < 2%, position 1-20
    const hasLowCtr = insights.some((qi) => qi.ctr < 0.02 && qi.position >= 1 && qi.position <= 20 && qi.impressions >= 10);
    if (hasLowCtr) {
      if (priority === "low") priority = "medium";
      reasons.push("CTRが低いクエリがあり、タイトル・ディスクリプション改善の余地がある可能性があります");
      suggestions.push("検索結果での見え方を確認し、タイトルの改善を検討してください");
    }

    // Check for growing/new
    const hasGrowing = insights.some((qi) => qi.suggestion?.type === "growing" || qi.suggestion?.type === "new_query");
    if (hasGrowing) {
      reasons.push("成長中またはの新規クエリからの流入がある可能性があります");
      suggestions.push("関連する内部リンクの追加を検討してください");
    }

    if (reasons.length === 0) continue;

    let slug = "";
    try {
      const pathname = new URL(page).pathname;
      const m = pathname.match(/\/articles\/(.+)/);
      if (m) slug = m[1];
    } catch { /* keep empty */ }

    const topQueries = insights
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map((qi) => ({ query: qi.query, position: qi.position, impressions: qi.impressions, ctr: qi.ctr }));

    enhancedItems.push({ page, slug, priority, reasons, suggestions, topQueries });
  }

  // Sort by priority, take top 5
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const enhancedActionItems = enhancedItems
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);

  return { queryInsights, enhancedActionItems, themeStats };
}

// ── メインエクスポート ──

export async function fetchSearchConsoleData(): Promise<SCData> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  if (!email || !privateKey || !siteUrl) {
    return {
      configured: false,
      error: "Search Console環境変数が未設定です（GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SEARCH_CONSOLE_SITE_URL）",
    };
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });

    // 日付計算（3日前までを終了日とする）
    const endDate = getPacificDate(-3);
    const current7dStart = getPacificDate(-9);
    const previous7dStart = getPacificDate(-16);
    const previous7dEnd = getPacificDate(-10);
    const current28dStart = getPacificDate(-30);
    const previous28dStart = getPacificDate(-58);
    const previous28dEnd = getPacificDate(-31);

    const [current7d, previous7d, current28d, previous28d] = await Promise.all([
      fetchPeriod(auth, siteUrl, current7dStart, endDate),
      fetchPeriod(auth, siteUrl, previous7dStart, previous7dEnd),
      fetchPeriod(auth, siteUrl, current28dStart, endDate),
      fetchPeriod(auth, siteUrl, previous28dStart, previous28dEnd),
    ]);

    const insights = deriveInsights({ current7d, previous7d, current28d, previous28d });
    const queryData = deriveQueryInsights({ current7d, previous7d });

    return {
      configured: true,
      current7d,
      previous7d,
      current28d,
      previous28d,
      ...insights,
      ...queryData,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 秘密情報を含めない
    const safeMsg = msg.includes("private_key")
      ? "認証エラー（秘密鍵の形式を確認してください）"
      : msg.includes("403")
        ? "権限エラー（Search Consoleプロパティにサービスアカウントを追加してください）"
        : msg.includes("404")
          ? "プロパティが見つかりません（SEARCH_CONSOLE_SITE_URLを確認してください）"
          : `Search Console APIエラー: ${msg.slice(0, 200)}`;
    return { configured: true, error: safeMsg };
  }
}
