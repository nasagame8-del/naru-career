#!/usr/bin/env node

/**
 * NARU Google Ads Keyword Planner snapshot generator.
 *
 * Google Ads API KeywordPlanIdeaService.GenerateKeywordIdeas を使って、
 * NARU向けキーワードの検索需要を取得する。
 *
 * 重要:
 * - exact search volume は公開Gitへコミットしない。
 * - 出力先は既定で data/private/keyword-demand.json（.gitignore対象）。
 * - Search Console 用と同じサービスアカウントを再利用できる。
 * - 2026-09-09以降の新規Google Ads API onboardingでは、
 *   API access level は Google Cloud project に紐づく。
 * - production account で KeywordPlanIdeaService を使うには Basic 以上が必要。
 */

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_VERSION = "v25";
const DEFAULT_CUSTOMER_GEO = "2392"; // Japan
const DEFAULT_LANGUAGE = "1005"; // Japanese
const DEFAULT_OUTPUT = path.join(process.cwd(), "data", "private", "keyword-demand.json");
const DEFAULT_SEEDS = [
  "第二新卒 転職",
  "未経験 IT 転職",
  "転職エージェント 第二新卒",
  "Web業界 転職",
  "第二新卒 面接",
];

export function normalizeCustomerId(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildGenerateKeywordIdeasRequest({
  keywords,
  geoTargetId = DEFAULT_CUSTOMER_GEO,
  languageId = DEFAULT_LANGUAGE,
}) {
  const cleaned = [...new Set((keywords ?? []).map((v) => String(v).trim()).filter(Boolean))];
  if (cleaned.length === 0) throw new Error("キーワードが1件もありません。");
  return {
    language: `languageConstants/${languageId}`,
    geoTargetConstants: [`geoTargetConstants/${geoTargetId}`],
    includeAdultKeywords: false,
    keywordPlanNetwork: "GOOGLE_SEARCH",
    keywordSeed: {
      keywords: cleaned,
    },
  };
}

export function compactKeywordIdeas(results, limit = 200) {
  const byKeyword = new Map();

  for (const row of results ?? []) {
    const text = String(row?.text ?? "").trim();
    if (!text) continue;
    const metrics = row?.keywordIdeaMetrics ?? {};
    const item = {
      keyword: text,
      avgMonthlySearches:
        metrics.avgMonthlySearches == null ? null : Number(metrics.avgMonthlySearches),
      competition: metrics.competition ?? "UNSPECIFIED",
      competitionIndex:
        metrics.competitionIndex == null ? null : Number(metrics.competitionIndex),
      lowTopOfPageBidMicros:
        metrics.lowTopOfPageBidMicros == null ? null : Number(metrics.lowTopOfPageBidMicros),
      highTopOfPageBidMicros:
        metrics.highTopOfPageBidMicros == null ? null : Number(metrics.highTopOfPageBidMicros),
      monthlySearchVolumes: (metrics.monthlySearchVolumes ?? []).map((m) => ({
        year: m.year ?? null,
        month: m.month ?? null,
        monthlySearches: m.monthlySearches == null ? null : Number(m.monthlySearches),
      })),
    };

    const existing = byKeyword.get(text);
    const currentVolume = item.avgMonthlySearches ?? -1;
    const existingVolume = existing?.avgMonthlySearches ?? -1;
    if (!existing || currentVolume > existingVolume) byKeyword.set(text, item);
  }

  return [...byKeyword.values()]
    .sort((a, b) => (b.avgMonthlySearches ?? -1) - (a.avgMonthlySearches ?? -1) || a.keyword.localeCompare(b.keyword, "ja"))
    .slice(0, Math.max(1, limit));
}

function parseArgs(argv) {
  const out = { keywords: [], output: DEFAULT_OUTPUT, limit: 200 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--keyword" && argv[i + 1]) {
      out.keywords.push(argv[++i]);
    } else if (arg === "--keywords" && argv[i + 1]) {
      out.keywords.push(...argv[++i].split(","));
    } else if (arg === "--output" && argv[i + 1]) {
      out.output = path.resolve(argv[++i]);
    } else if (arg === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, Number(argv[++i]) || 200);
    }
  }
  if (out.keywords.length === 0) out.keywords = [...DEFAULT_SEEDS];
  return out;
}

async function accessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY が未設定です。Search Consoleと同じサービスアカウントを再利用できます。"
    );
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/adwords"],
  });
  const token = await auth.getAccessToken();
  if (!token.token) throw new Error("Google OAuth access token を取得できませんでした。");
  return token.token;
}

async function fetchKeywordIdeas({ keywords, customerId, loginCustomerId, apiVersion }) {
  const token = await accessToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 旧developer token環境との互換用。2026-09-09以降の新規onboardingでは
  // Cloud projectのAPI access levelが正本で、この値は必須ではない。
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    headers["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  }
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const body = buildGenerateKeywordIdeasRequest({
    keywords,
    geoTargetId: process.env.GOOGLE_ADS_GEO_TARGET_ID || DEFAULT_CUSTOMER_GEO,
    languageId: process.env.GOOGLE_ADS_LANGUAGE_ID || DEFAULT_LANGUAGE,
  });

  const endpoint =
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}:generateKeywordIdeas`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.details?.[0]?.errors?.[0]?.message ||
      response.statusText;
    if (response.status === 403) {
      throw new Error(
        `Google Ads API 403: ${message}. KeywordPlanIdeaService は production account では Basic access 以上が必要です。`
      );
    }
    throw new Error(`Google Ads API ${response.status}: ${message}`);
  }
  return payload?.results ?? [];
}

async function main() {
  const { keywords, output, limit } = parseArgs(process.argv.slice(2));
  const customerId = normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerId = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION || DEFAULT_API_VERSION;

  if (!customerId) {
    throw new Error("GOOGLE_ADS_CUSTOMER_ID が未設定です。Google Adsの10桁Customer IDを設定してください。");
  }

  const rows = await fetchKeywordIdeas({
    keywords,
    customerId,
    loginCustomerId: loginCustomerId || null,
    apiVersion,
  });
  const ideas = compactKeywordIdeas(rows, limit);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "google-ads-keyword-planner",
    apiVersion,
    target: {
      country: "JP",
      geoTargetId: process.env.GOOGLE_ADS_GEO_TARGET_ID || DEFAULT_CUSTOMER_GEO,
      language: "ja",
      languageId: process.env.GOOGLE_ADS_LANGUAGE_ID || DEFAULT_LANGUAGE,
      network: "GOOGLE_SEARCH",
    },
    seeds: keywords,
    resultCount: ideas.length,
    ideas,
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`${output} を更新しました（${ideas.length}件）。`);
  for (const item of ideas.slice(0, 20)) {
    console.log(
      `${String(item.avgMonthlySearches ?? "-").padStart(8)}  ${item.competition.padEnd(8)}  ${item.keyword}`
    );
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  });
}
