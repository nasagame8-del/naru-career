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

// ── GSC: Search Console API直接取得（lib層に分離）──
import { fetchSearchConsoleData } from "@/lib/search-console";

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");
  const articlesDir = path.join(process.cwd(), "content", "articles");

  const aspStatus = readJson(path.join(dataDir, "asp-status.json"));
  const articlesStatus = readJson(path.join(dataDir, "articles-status.json"));
  const ctaRegistry = readJson(path.join(dataDir, "cta-registry.json"));

  // キーワード一覧: articles-status.json から統合取得（keywords.csv廃止）
  const allArticles = (articlesStatus?.articles || []) as {
    slug: string; keyword?: string; priority?: string; status: string; cluster?: string;
  }[];
  const pendingFromArticles = allArticles
    .filter((a) => a.keyword && a.status !== "factchecked" && a.status !== "published")
    .map((a) => ({
      keyword: a.keyword,
      priority: a.priority || "medium",
      status: a.status,
      cluster: a.cluster || "",
    }));
  const pendingOrphan = (articlesStatus?.pending_keywords || []) as {
    keyword: string; category?: string; priority: string; status: string;
  }[];
  const pendingKeywords = [...pendingFromArticles, ...pendingOrphan];

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
  const [ga4, gsc] = await Promise.all([fetchGA4Data(), fetchSearchConsoleData()]);

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
