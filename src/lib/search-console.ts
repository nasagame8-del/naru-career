/**
 * Google Search Console API 直接取得
 *
 * 環境変数:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   SEARCH_CONSOLE_SITE_URL (例: sc-domain:naru-career.com)
 */

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
    querySearchConsole(auth, siteUrl, startDate, endDate, ["query"], 20),
    querySearchConsole(auth, siteUrl, startDate, endDate, ["page"], 20),
    querySearchConsole(auth, siteUrl, startDate, endDate, ["page", "query"], 50),
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

    return {
      configured: true,
      current7d,
      previous7d,
      current28d,
      previous28d,
      ...insights,
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
