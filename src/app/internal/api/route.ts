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

  // AIOチェックリスト
  const aioChecklist = articleFiles.map((f) => {
    const slug = f.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(articlesDir, f), "utf-8");
    const { data, content } = matter(raw);
    const hasPerson = true; // Person構造化データは全記事共通テンプレートで出力
    const hasFaq = (data.faq?.length || 0) > 0;
    const hasExperience = /experience-notes|実体験|僕[はがの]|前職/i.test(content);
    const hasComparisonTable = /comparison-table|ComparisonTable|COMPARISON_TABLE/i.test(content) || (data.widgets?.some((w: { type: string }) => w.type === "comparison-table") ?? false);
    const hasAuthoritativeSource = /厚生労働省|経済産業省|出典|参考：|参照：|調査[）)]/i.test(content);
    const hasImage = fs.existsSync(path.join(process.cwd(), "public", "images", "articles", `${slug}-card.png`));
    const hasUpdateHistory = (data.updateHistory?.length || 0) > 0;
    return {
      slug,
      title: data.title || slug,
      checks: {
        person: hasPerson,
        faq: hasFaq,
        experience: hasExperience,
        comparisonTable: hasComparisonTable,
        authoritativeSource: hasAuthoritativeSource,
        image: hasImage,
        updateHistory: hasUpdateHistory,
      },
    };
  });

  // 内部リンク分析
  const internalLinks: { slug: string; outgoing: number; incoming: number }[] = [];
  const linkMap: Record<string, string[]> = {};
  for (const f of articleFiles) {
    const slug = f.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(articlesDir, f), "utf-8");
    const { content: body } = matter(raw);
    const outLinks: string[] = [];
    const linkRegex = /\[.*?\]\(\/articles\/([\w-]+)\)/g;
    let m;
    while ((m = linkRegex.exec(body)) !== null) {
      if (m[1] !== slug) outLinks.push(m[1]);
    }
    linkMap[slug] = [...new Set(outLinks)];
  }
  for (const f of articleFiles) {
    const slug = f.replace(/\.md$/, "");
    const outgoing = linkMap[slug]?.length || 0;
    const incoming = Object.values(linkMap).filter((links) => links.includes(slug)).length;
    internalLinks.push({ slug, outgoing, incoming });
  }

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
    aioChecklist,
    internalLinks,
  });
}
