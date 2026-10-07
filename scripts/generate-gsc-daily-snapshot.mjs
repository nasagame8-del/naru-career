#!/usr/bin/env node

/**
 * Generate NARU's private daily GSC snapshot and a public privacy-safe signal file.
 *
 * Private outputs (GitHub Actions artifact only):
 *   tmp/gsc-daily-snapshot.json
 *   tmp/gsc-daily-slack.txt
 *
 * Public output (committed):
 *   data/gsc-signal.json
 *
 * The public file intentionally omits clicks, impressions, CTR and per-query metrics.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  getSearchConsoleSiteUrl,
  pacificDateDaysAgo,
  querySearchAnalytics,
  resolveSearchConsoleAuth,
} from "./lib/gsc-auth.mjs";

const TMP_DIR = path.join(process.cwd(), "tmp");
const RAW_PATH = path.join(TMP_DIR, "gsc-daily-snapshot.json");
const SLACK_PATH = path.join(TMP_DIR, "gsc-daily-slack.txt");
const PUBLIC_PATH = path.join(process.cwd(), "data", "gsc-signal.json");

function pctChange(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

function fmtChange(current, previous, digits = 0) {
  const change = pctChange(current, previous);
  if (change === null) return "new";
  const rounded = change.toFixed(digits);
  return `${change >= 0 ? "+" : ""}${rounded}%`;
}

function normalizeRows(rows) {
  return (rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0),
  }));
}

async function fetchPeriod(auth, siteUrl, startDate, endDate) {
  const common = { startDate, endDate, type: "web", dataState: "final" };

  const [totalRes, queryRes, pageRes, pageQueryRes] = await Promise.all([
    querySearchAnalytics(auth, siteUrl, common),
    querySearchAnalytics(auth, siteUrl, {
      ...common,
      dimensions: ["query"],
      rowLimit: 25000,
    }),
    querySearchAnalytics(auth, siteUrl, {
      ...common,
      dimensions: ["page"],
      rowLimit: 25000,
    }),
    querySearchAnalytics(auth, siteUrl, {
      ...common,
      dimensions: ["page", "query"],
      rowLimit: 25000,
    }),
  ]);

  const totalRow = normalizeRows(totalRes.rows)[0] ?? {
    keys: [],
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };

  return {
    startDate,
    endDate,
    total: {
      clicks: totalRow.clicks,
      impressions: totalRow.impressions,
      ctr: totalRow.ctr,
      position: totalRow.position,
    },
    queries: normalizeRows(queryRes.rows),
    pages: normalizeRows(pageRes.rows),
    pageQueries: normalizeRows(pageQueryRes.rows),
  };
}

function bucketCounts(queries) {
  const atMost = (n) => queries.filter((row) => row.position > 0 && row.position <= n).length;
  return {
    top3: atMost(3),
    top10: atMost(10),
    top20: atMost(20),
  };
}

function positionBand(position) {
  if (position <= 3) return "1-3";
  if (position <= 10) return "4-10";
  if (position <= 20) return "11-20";
  if (position <= 40) return "21-40";
  return "41+";
}

function buildSignals(current, previous) {
  const previousByQuery = new Map(previous.queries.map((row) => [row.keys[0], row]));
  const currentByQuery = new Map(current.queries.map((row) => [row.keys[0], row]));
  const previousByPage = new Map(previous.pages.map((row) => [row.keys[0], row]));

  const newQueries = current.queries.filter((row) => !previousByQuery.has(row.keys[0]));

  const quickWins = current.queries
    .filter(
      (row) =>
        row.position >= 5 &&
        row.position <= 15 &&
        row.impressions >= 5 &&
        (row.clicks === 0 || row.ctr < 0.02)
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((row) => ({
      query: row.keys[0],
      positionBand: positionBand(row.position),
      signal: "quick_win",
    }));

  const rising = current.queries
    .map((row) => {
      const prev = previousByQuery.get(row.keys[0]);
      if (!prev) return null;
      const impressionDelta = pctChange(row.impressions, prev.impressions);
      const improvedPosition = prev.position - row.position;
      if (
        (impressionDelta !== null && impressionDelta >= 50 && row.impressions >= 5) ||
        improvedPosition >= 5
      ) {
        return {
          query: row.keys[0],
          positionBand: positionBand(row.position),
          signal: "rising",
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 12);

  const newSignals = newQueries
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((row) => ({
      query: row.keys[0],
      positionBand: positionBand(row.position),
      signal: "new",
    }));

  const pageSignals = current.pages
    .map((row) => {
      const prev = previousByPage.get(row.keys[0]);
      const impressionsChange = prev ? pctChange(row.impressions, prev.impressions) : null;
      if (!prev || (impressionsChange !== null && impressionsChange >= 50)) {
        let pathname = row.keys[0];
        try {
          pathname = new URL(row.keys[0]).pathname;
        } catch {}
        return {
          page: pathname,
          positionBand: positionBand(row.position),
          signal: prev ? "rising" : "new",
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 15);

  return {
    visibleQueryCounts: {
      current: current.queries.length,
      previous: previous.queries.length,
      new: newQueries.length,
    },
    positionBuckets: {
      current: bucketCounts(current.queries),
      previous: bucketCounts(previous.queries),
    },
    querySignals: [...quickWins, ...rising, ...newSignals].slice(0, 25),
    pageSignals,
    _currentByQueryCount: currentByQuery.size,
  };
}

function topRows(rows, limit = 10) {
  return [...rows]
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, limit);
}

function buildSlackText(snapshot, signals) {
  const c = snapshot.current14.total;
  const p = snapshot.previous14.total;
  const buckets = signals.positionBuckets;

  const lines = [
    "NARU_GSC_DAILY",
    `確定期間: ${snapshot.current14.startDate}〜${snapshot.current14.endDate} vs ${snapshot.previous14.startDate}〜${snapshot.previous14.endDate}`,
    "",
    `総表示回数: ${c.impressions}（前期 ${p.impressions} / ${fmtChange(c.impressions, p.impressions, 1)}）`,
    `クリック: ${c.clicks}（前期 ${p.clicks} / ${fmtChange(c.clicks, p.clicks, 1)}）`,
    `CTR: ${(c.ctr * 100).toFixed(2)}%（前期 ${(p.ctr * 100).toFixed(2)}%）`,
    `平均掲載順位: ${c.position.toFixed(2)}（前期 ${p.position.toFixed(2)}）`,
    "",
    `可視クエリ数: ${signals.visibleQueryCounts.current}（前期 ${signals.visibleQueryCounts.previous} / 新規 ${signals.visibleQueryCounts.new}）`,
    `Top3: ${buckets.current.top3}（前期 ${buckets.previous.top3}）`,
    `Top10: ${buckets.current.top10}（前期 ${buckets.previous.top10}）`,
    `Top20: ${buckets.current.top20}（前期 ${buckets.previous.top20}）`,
    "",
    "表示上位クエリ:",
  ];

  for (const row of topRows(snapshot.current14.queries, 10)) {
    lines.push(
      `- ${row.keys[0]} | imp ${row.impressions} | click ${row.clicks} | pos ${row.position.toFixed(
        1
      )} | CTR ${(row.ctr * 100).toFixed(1)}%`
    );
  }

  lines.push("", "表示上位ページ:");
  for (const row of topRows(snapshot.current14.pages, 8)) {
    let pathname = row.keys[0];
    try {
      pathname = new URL(row.keys[0]).pathname;
    } catch {}
    lines.push(
      `- ${pathname} | imp ${row.impressions} | click ${row.clicks} | pos ${row.position.toFixed(
        1
      )}`
    );
  }

  lines.push(
    "",
    "注: クエリ行はSearch Consoleのプライバシー処理で全表示を網羅しないため、Top3/10/20と可視クエリ数は可視行ベース。サイト総表示回数はtotal行を使用。"
  );

  return lines.join("\n");
}

export async function generateDailyGscSnapshot() {
  const siteUrl = getSearchConsoleSiteUrl();
  const auth = await resolveSearchConsoleAuth();

  const currentEnd = pacificDateDaysAgo(3);
  const currentStart = pacificDateDaysAgo(16);
  const previousEnd = pacificDateDaysAgo(17);
  const previousStart = pacificDateDaysAgo(30);
  const current28Start = pacificDateDaysAgo(30);

  const [current14, previous14, current28] = await Promise.all([
    fetchPeriod(auth, siteUrl, currentStart, currentEnd),
    fetchPeriod(auth, siteUrl, previousStart, previousEnd),
    fetchPeriod(auth, siteUrl, current28Start, currentEnd),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    siteUrl,
    source: "Google Search Console API",
    dataState: "final",
    current14,
    previous14,
    current28,
  };

  const signals = buildSignals(current14, previous14);
  delete signals._currentByQueryCount;

  const publicSnapshot = {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    dataState: snapshot.dataState,
    privacy: "traffic_metrics_omitted",
    currentRange: {
      startDate: current14.startDate,
      endDate: current14.endDate,
    },
    previousRange: {
      startDate: previous14.startDate,
      endDate: previous14.endDate,
    },
    ...signals,
  };

  const slackText = buildSlackText(snapshot, signals);

  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(path.dirname(PUBLIC_PATH), { recursive: true });
  await fs.writeFile(RAW_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  await fs.writeFile(SLACK_PATH, slackText + "\n", "utf8");
  await fs.writeFile(PUBLIC_PATH, JSON.stringify(publicSnapshot, null, 2) + "\n", "utf8");

  console.log(
    `GSC daily snapshot generated: ${current14.startDate}..${current14.endDate}; visible queries=${current14.queries.length}`
  );

  return { snapshot, publicSnapshot, slackText };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  generateDailyGscSnapshot().catch((error) => {
    console.error(
      `GSC daily snapshot failed: ${String(error?.message ?? error).slice(0, 300)}`
    );
    process.exit(1);
  });
}
