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
type GA4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

async function refreshGoogleOAuthAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth環境変数が未設定です");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept-Encoding": "identity",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `Google OAuth refresh failed: ${body.error ?? response.status}${
        body.error_description ? ` ${body.error_description}` : ""
      }`
    );
  }

  return body.access_token;
}

async function runGA4Report(
  propertyId: string,
  accessToken: string,
  requestBody: Record<string, unknown>
): Promise<GA4RunReportResponse> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`GA4 Data API ${response.status}: ${raw.slice(0, 300)}`);
  }
  return raw ? (JSON.parse(raw) as GA4RunReportResponse) : {};
}

async function fetchGA4Data() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return { configured: false, error: "GA4_PROPERTY_IDが未設定です" };
  }

  try {
    const hasOAuth = Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    );

    if (hasOAuth) {
      const accessToken = await refreshGoogleOAuthAccessToken();

      const [report7d, report28d, topPages] = await Promise.all([
        runGA4Report(propertyId, accessToken, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        }),
        runGA4Report(propertyId, accessToken, {
          dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        }),
        runGA4Report(propertyId, accessToken, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: {
            notExpression: {
              orGroup: {
                expressions: [
                  { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/internal" } } },
                  { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/api" } } },
                  { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/members" } } },
                ],
              },
            },
          },
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "10",
        }),
      ]);

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
    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!email || !privateKey) {
      return { configured: false, error: "GA4認証環境変数が未設定です" };
    }

    const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: email, private_key: privateKey },
    });

    const [report7d] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    });
    const [report28d] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    });
    const [topPages] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        notExpression: {
          orGroup: {
            expressions: [
              { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/internal" } } },
              { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/api" } } },
              { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/members" } } },
            ],
          },
        },
      },
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
    const msg = e instanceof Error ? e.message : String(e);
    return { configured: true, error: `GA4 APIエラー: ${msg.slice(0, 400)}` };
  }
}

// ── GSC: Search Console API直接取得（lib層に分離）──
import { fetchSearchConsoleData } from "@/lib/search-console";
import { buildGrowthLab, type GrowthArticleInput, type ResearchSource, type ResearchSourceStatus } from "@/lib/growth-lab";

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
    const hasImage = ["webp", "png"].some((extension) =>
      fs.existsSync(
        path.join(process.cwd(), "public", "images", "articles", `${slug}-card.${extension}`)
      )
    );
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

  // Growth Lab用の記事特徴量。外部AI APIは使わず、Markdownとfrontmatterだけを解析する。
  const growthArticles: GrowthArticleInput[] = articleFiles.map((f) => {
    const slug = f.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(articlesDir, f), "utf-8");
    const { data, content } = matter(raw);
    const outgoing = [...content.matchAll(/\[[^\]]*\]\(\/articles\/([\w-]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => target && target !== slug);
    return {
      slug,
      title: data.title || slug,
      keyword: data.keyword || "",
      body: content,
      outgoing: [...new Set(outgoing)],
      faqCount: Array.isArray(data.faq) ? data.faq.length : 0,
      summaryCount: Array.isArray(data.summary) ? data.summary.length : 0,
      hasAuthoritativeSource: /厚生労働省|経済産業省|総務省|公正取引委員会|個人情報保護委員会|IPA|出典|参考：|参照：|https?:\/\/(?:www\.)?(?:mhlw\.go\.jp|meti\.go\.jp|soumu\.go\.jp|jftc\.go\.jp|ppc\.go\.jp|ipa\.go\.jp)/i.test(content),
      hasUpdateHistory: Array.isArray(data.updateHistory) && data.updateHistory.length > 0,
      hasImage: ["webp", "png"].some((extension) =>
        fs.existsSync(path.join(process.cwd(), "public", "images", "articles", `${slug}-card.${extension}`))
      ),
      hasComparisonTable:
        /\|[^\n]+\|\s*\n\|[-: |]+\|/m.test(content) ||
        /COMPARISON_TABLE|comparison-table/i.test(content),
    };
  });

  const researchConfig = readJson(path.join(dataDir, "research-sources.json"));
  const researchStatus = readJson(path.join(dataDir, "research", "source-status.json"));
  const researchSources = (researchConfig?.sources || []) as ResearchSource[];
  const researchStatuses = (researchStatus?.sources || []) as ResearchSourceStatus[];

  // GA4 & GSC（並列取得）
  const [ga4, gsc] = await Promise.all([fetchGA4Data(), fetchSearchConsoleData()]);
  const growthLab = buildGrowthLab({
    gsc,
    articles: growthArticles,
    researchSources,
    researchStatuses,
  });

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
    growthLab,
  });
}
