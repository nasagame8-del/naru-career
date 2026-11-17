#!/usr/bin/env node

/**
 * NARU SEO Opportunity snapshot generator.
 *
 * Search Console の page × query データから、朝の記事選定で使う
 * 「既存記事を伸ばす機会」と「カニバリ候補」を抽出する。
 *
 * 公開リポジトリへ clicks / impressions / CTR / position の実数値は保存しない。
 * 保存するのは分類・順位・slug・query と、閾値ベースの理由だけ。
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  getSearchConsoleSiteUrl,
  querySearchAnalytics,
  resolveSearchConsoleAuth,
} from "./lib/gsc-auth.mjs";

const OUT_PATH = path.join(process.cwd(), "data", "seo-opportunities.json");
const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");
const WINDOW_LABEL = "過去28日";
const MIN_IMPRESSIONS = 5;
const STRIKING_MIN = 11;
const STRIKING_MAX = 30;
const LOW_CTR_MAX = 0.02;
const LOW_CTR_POSITION_MAX = 10;

export function slugFromPage(pageUrl) {
  try {
    // URL parsing removes query strings and fragments for both absolute and
    // relative Search Console page keys before extracting the canonical path.
    const url = new URL(pageUrl, "https://naru-career.com");
    const match = url.pathname.match(/^\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function normalizedRow(row, knownSlugs) {
  const [page, rawQuery] = row?.keys ?? [];
  const slug = page ? slugFromPage(page) : null;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!slug || !query || !knownSlugs.has(slug)) return null;

  const clicks = Number(row.clicks ?? 0);
  const impressions = Number(row.impressions ?? 0);
  const position = Number(row.position ?? 0);
  if (![clicks, impressions, position].every(Number.isFinite)) return null;

  return { slug, query, clicks, impressions, position };
}

/**
 * Collapse URL variants (fragment/query/trailing slash) to one slug × query.
 * Counts are additive; CTR is recomputed from totals and position is weighted
 * by impressions, matching Search Console's aggregation semantics.
 */
export function aggregatePageQueryRows(rows, knownSlugs) {
  const grouped = new Map();

  for (const source of rows ?? []) {
    const row = normalizedRow(source, knownSlugs);
    if (!row) continue;

    const key = JSON.stringify([row.slug, row.query]);
    const current = grouped.get(key) ?? {
      slug: row.slug,
      query: row.query,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * row.impressions;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .filter((row) => row.impressions > 0)
    .map((row) => ({
      slug: row.slug,
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.clicks / row.impressions,
      position: row.weightedPosition / row.impressions,
    }));
}

export function buildSeoOpportunities(rows, knownSlugs) {
  const valid = aggregatePageQueryRows(rows, knownSlugs)
    .filter((row) => row.impressions >= MIN_IMPRESSIONS);

  const strikingDistance = valid
    .filter((row) => row.position >= STRIKING_MIN && row.position <= STRIKING_MAX)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .map((row, index) => ({
      rank: index + 1,
      slug: row.slug,
      query: row.query,
      reason: "position_11_30",
    }));

  const lowCtr = valid
    .filter((row) => row.position > 0 && row.position <= LOW_CTR_POSITION_MAX && row.ctr <= LOW_CTR_MAX)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .map((row, index) => ({
      rank: index + 1,
      slug: row.slug,
      query: row.query,
      reason: "low_ctr_top10",
    }));

  const byQuery = new Map();
  for (const row of valid) {
    const list = byQuery.get(row.query) ?? [];
    list.push(row);
    byQuery.set(row.query, list);
  }

  const cannibalization = [...byQuery.entries()]
    .map(([query, queryRows]) => {
      const slugs = [...new Set(queryRows.map((row) => row.slug))];
      const impressions = queryRows.reduce((sum, row) => sum + row.impressions, 0);
      return { query, slugs, impressions };
    })
    .filter((item) => item.slugs.length >= 2)
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query))
    .map((item, index) => ({
      rank: index + 1,
      query: item.query,
      slugs: item.slugs.sort(),
      reason: "multiple_articles_same_query",
    }));

  const prioritySlugs = [];
  for (const item of [...strikingDistance, ...lowCtr]) {
    if (!prioritySlugs.includes(item.slug)) prioritySlugs.push(item.slug);
  }

  return {
    strikingDistance,
    lowCtr,
    cannibalization,
    prioritySlugs,
  };
}

async function knownArticleSlugs() {
  const files = await fs.readdir(ARTICLES_DIR);
  return new Set(
    files
      .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
      .map((f) => f.replace(/\.md$/, ""))
  );
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  let rows;

  if (process.env.GSC_SNAPSHOT_INPUT) {
    const snapshot = JSON.parse(
      await fs.readFile(path.resolve(process.env.GSC_SNAPSHOT_INPUT), "utf8")
    );
    rows = snapshot?.current28?.pageQueries ?? [];
  } else {
    const siteUrl = getSearchConsoleSiteUrl();
    const auth = await resolveSearchConsoleAuth();
    const endDate = daysAgo(-3);
    const startDate = daysAgo(-30);
    const response = await querySearchAnalytics(auth, siteUrl, {
      startDate,
      endDate,
      dimensions: ["page", "query"],
      rowLimit: 25000,
      type: "web",
      dataState: "final",
    });
    rows = response.rows ?? [];
  }

  const known = await knownArticleSlugs();
  const opportunities = buildSeoOpportunities(rows, known);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    window: WINDOW_LABEL,
    privacy: "metrics_omitted",
    aggregation: "canonical_slug_query; additive_clicks_impressions; impression_weighted_position",
    thresholds: {
      minImpressions: MIN_IMPRESSIONS,
      strikingDistancePosition: [STRIKING_MIN, STRIKING_MAX],
      lowCtrPositionMax: LOW_CTR_POSITION_MAX,
      lowCtrMax: LOW_CTR_MAX,
    },
    ...opportunities,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log("data/seo-opportunities.json を更新しました。");
  console.log(`伸長候補 ${opportunities.strikingDistance.length} / CTR候補 ${opportunities.lowCtr.length} / カニバリ候補 ${opportunities.cannibalization.length}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(`取得に失敗しました: ${String(error?.message ?? error).slice(0, 200)}`);
    process.exit(1);
  });
}
