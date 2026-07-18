import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export const dynamic = "force-dynamic";

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

// ── GA4 Data API ──
async function fetchGA4Data() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!propertyId || !email || !privateKey) {
    return { configured: false, error: "GA4環境変数が未設定です" };
  }

  try {
    const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: email, private_key: privateKey },
    });

    // 7日間のアクティブユーザー・PV
    const [report7d] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
      ],
    });

    // 28日間
    const [report28d] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
      ],
    });

    // 人気記事ランキング（7日間、上位10件）
    const [topPages] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const row7d = report7d.rows?.[0];
    const row28d = report28d.rows?.[0];

    return {
      configured: true,
      users7d: Number(row7d?.metricValues?.[0]?.value || 0),
      pv7d: Number(row7d?.metricValues?.[1]?.value || 0),
      users28d: Number(row28d?.metricValues?.[0]?.value || 0),
      pv28d: Number(row28d?.metricValues?.[1]?.value || 0),
      topPages: (topPages.rows || []).map((r) => ({
        path: r.dimensionValues?.[0]?.value || "",
        views: Number(r.metricValues?.[0]?.value || 0),
      })),
    };
  } catch (e) {
    return { configured: true, error: String(e) };
  }
}

// ── Google Sheets (Search Console データ) ──
async function fetchGSCData() {
  const spreadsheetId = process.env.GSC_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!spreadsheetId || !email || !privateKey) {
    return { configured: false, error: "スプレッドシート環境変数が未設定です" };
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // シートの全データを取得（ヘッダー行 + データ行）
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A:F", // Date, Query, Page, Clicks, Impressions, CTR, Position
    });

    const rows = res.data.values;
    if (!rows || rows.length < 2) {
      return { configured: true, error: "シートにデータがありません" };
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    const dateIdx = headers.findIndex((h: string) => h.includes("date"));
    const queryIdx = headers.findIndex((h: string) => h.includes("query") || h.includes("検索"));
    const clickIdx = headers.findIndex((h: string) => h.includes("click"));
    const impIdx = headers.findIndex((h: string) => h.includes("impression") || h.includes("表示"));
    const ctrIdx = headers.findIndex((h: string) => h.includes("ctr"));
    const posIdx = headers.findIndex((h: string) => h.includes("position") || h.includes("順位"));

    // 直近7日のデータをフィルタ
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let latestDate = "";

    let totalClicks = 0;
    let totalImpressions = 0;
    let totalCtr = 0;
    let totalPosition = 0;
    let count = 0;
    const queryMap = new Map<string, number>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateStr = dateIdx >= 0 ? row[dateIdx] : "";
      if (!dateStr) continue;

      if (dateStr > latestDate) latestDate = dateStr;

      const rowDate = new Date(dateStr);
      if (rowDate < sevenDaysAgo) continue;

      const clicks = Number(row[clickIdx] || 0);
      const impressions = Number(row[impIdx] || 0);
      const ctr = Number(row[ctrIdx] || 0);
      const position = Number(row[posIdx] || 0);

      totalClicks += clicks;
      totalImpressions += impressions;
      totalCtr += ctr;
      totalPosition += position;
      count++;

      if (queryIdx >= 0) {
        const query = row[queryIdx] || "";
        if (query) {
          queryMap.set(query, (queryMap.get(query) || 0) + clicks);
        }
      }
    }

    // データ鮮度チェック（最新日が2日以上前なら警告）
    const latestDateObj = new Date(latestDate);
    const daysSinceLatest = Math.floor((now.getTime() - latestDateObj.getTime()) / (24 * 60 * 60 * 1000));
    const stale = daysSinceLatest >= 2;

    // 上位クエリ
    const topQueries = [...queryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, clicks]) => ({ query, clicks }));

    return {
      configured: true,
      stale,
      latestDate,
      daysSinceLatest,
      totalClicks,
      totalImpressions,
      avgCtr: count > 0 ? (totalCtr / count * 100).toFixed(1) : "0",
      avgPosition: count > 0 ? (totalPosition / count).toFixed(1) : "0",
      topQueries,
    };
  } catch (e) {
    return { configured: true, error: String(e) };
  }
}

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");
  const articlesDir = path.join(process.cwd(), "content", "articles");

  const aspStatus = readJson(path.join(dataDir, "asp-status.json"));
  const articlesStatus = readJson(path.join(dataDir, "articles-status.json"));
  const ctaRegistry = readJson(path.join(dataDir, "cta-registry.json"));
  const keywords = readCsv(path.join(dataDir, "keywords.csv"));
  const pendingKeywords = keywords.filter((k) => k.status !== "published");

  const articleFiles = fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    : [];

  let publishedCount = 0;
  for (const file of articleFiles) {
    publishedCount++;
  }

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scheduled = (articlesStatus?.articles || [])
    .filter((a: { scheduled_publish?: string }) => {
      if (!a.scheduled_publish) return false;
      const d = new Date(a.scheduled_publish);
      return d >= now && d <= sevenDaysLater;
    })
    .sort((a: { scheduled_publish: string }, b: { scheduled_publish: string }) =>
      a.scheduled_publish.localeCompare(b.scheduled_publish)
    );

  const THRESHOLD_DAYS = 180;
  const reviewDue = (articlesStatus?.articles || []).filter((a: { lastReviewDate?: string }) => {
    const baseDate = a.lastReviewDate;
    if (!baseDate) return false;
    const elapsed = Math.floor((now.getTime() - new Date(baseDate).getTime()) / (24 * 60 * 60 * 1000));
    return elapsed >= THRESHOLD_DAYS;
  });

  // CTA URL未設定数
  const ctaEntries = ctaRegistry ? Object.values(ctaRegistry) as { url: string }[] : [];
  const ctaMissing = ctaEntries.filter((e) => !e.url).length;

  // ASPサマリー
  const aspApproved = aspStatus?.asps?.filter((a: { status: string }) => a.status === "approved").length || 0;
  const aspPending = aspStatus?.asps?.filter((a: { status: string }) => a.status === "pending").length || 0;

  // GA4 & GSC（並列取得）
  const [ga4, gsc] = await Promise.all([fetchGA4Data(), fetchGSCData()]);

  return NextResponse.json({
    summary: {
      articles: publishedCount,
      scheduled: scheduled.length,
      reviewDue: reviewDue.length,
      ctaMissing,
      aspApproved,
      aspPending,
      keywords: pendingKeywords.length,
    },
    asp: aspStatus,
    site: { publishedCount, totalArticles: articleFiles.length, scheduled, reviewDue },
    cta: ctaRegistry,
    keywords: pendingKeywords,
    ga4,
    gsc,
  });
}
