#!/usr/bin/env node

/**
 * SEO Editor 実験の7/14/28日チェック。
 *
 * data/seo-runs/<run-id>.json を読み、選択テーマの実測クエリについて
 * 「変更前7日」と各チェックポイント直前7日をGSCで比較する。
 *
 * GSCの確定遅延を考慮し、チェックポイント終了日から3日経過するまでは
 * pendingのままにする。外部有料APIは使わない。
 */

import fs from "node:fs/promises";
import path from "node:path";

const RUN_DIR = path.join(process.cwd(), "data", "seo-runs");
const OUT_DIR = path.join(process.cwd(), "data", "seo-experiments");
const CHECKPOINTS = [7, 14, 28];
const SETTLEMENT_LAG_DAYS = 3;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function checkpointWindow(runDate, day) {
  return {
    startDate: addDays(runDate, day - 6),
    endDate: addDays(runDate, day),
  };
}

export function baselineWindow(runDate) {
  return {
    startDate: addDays(runDate, -7),
    endDate: addDays(runDate, -1),
  };
}

export function summarizeRows(rows) {
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + Number(row.position || 0) * Number(row.impressions || 0),
    0
  );
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

function delta(current, baseline) {
  return {
    clicks: current.clicks - baseline.clicks,
    impressions: current.impressions - baseline.impressions,
    ctr: current.ctr - baseline.ctr,
    position: current.position > 0 && baseline.position > 0
      ? current.position - baseline.position
      : null,
  };
}

function selectedRunId() {
  const i = process.argv.indexOf("--run");
  return i >= 0 ? process.argv[i + 1] : null;
}

async function readRuns() {
  const only = selectedRunId();
  const files = await fs.readdir(RUN_DIR).catch(() => []);
  const picked = files.filter((f) => f.endsWith(".json") && (!only || f === `${only}.json`));
  const runs = [];
  for (const file of picked) {
    const raw = JSON.parse(await fs.readFile(path.join(RUN_DIR, file), "utf8"));
    if (raw?.selectedTopic?.queries?.length) runs.push(raw);
  }
  return runs;
}

async function queryWindow(searchconsole, siteUrl, query, relatedPages, window) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ["query", "page"],
      dimensionFilterGroups: [{
        filters: [{
          dimension: "query",
          operator: "equals",
          expression: query,
        }],
      }],
      rowLimit: 25000,
      type: "web",
      dataState: "final",
    },
  });

  const allowed = new Set(relatedPages || []);
  const rows = (res.data.rows || [])
    .map((r) => ({
      query: r.keys?.[0] || "",
      page: r.keys?.[1] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }))
    .filter((r) => allowed.size === 0 || allowed.has(r.page));

  return summarizeRows(rows);
}

async function measureRun(searchconsole, siteUrl, run) {
  const runDate = String(run.createdAt || "").slice(0, 10);
  const relatedPages = run.selectedTopic?.relatedPages || [];
  const queries = run.selectedTopic?.queries?.map((q) => q.query).filter(Boolean) || [];
  if (!runDate || queries.length === 0) return null;

  const baselineRange = baselineWindow(runDate);
  const baselineByQuery = {};
  for (const query of queries) {
    baselineByQuery[query] = await queryWindow(
      searchconsole,
      siteUrl,
      query,
      relatedPages,
      baselineRange
    );
  }

  const settledCutoff = addDays(isoDate(new Date()), -SETTLEMENT_LAG_DAYS);
  const checkpoints = [];

  for (const day of CHECKPOINTS) {
    const range = checkpointWindow(runDate, day);
    if (range.endDate > settledCutoff) {
      checkpoints.push({ day, status: "pending", window: range });
      continue;
    }

    const byQuery = {};
    for (const query of queries) {
      const current = await queryWindow(searchconsole, siteUrl, query, relatedPages, range);
      byQuery[query] = {
        ...current,
        delta: delta(current, baselineByQuery[query]),
      };
    }
    checkpoints.push({ day, status: "measured", window: range, byQuery });
  }

  return {
    runId: run.id,
    topic: run.selectedTopic?.topic || "",
    measuredAt: new Date().toISOString(),
    relatedPages,
    baseline: { window: baselineRange, byQuery: baselineByQuery },
    checkpoints,
  };
}

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;
  if (!email || !privateKey || !siteUrl) {
    throw new Error(
      "GSC環境変数が未設定です（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / SEARCH_CONSOLE_SITE_URL）"
    );
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const runs = await readRuns();
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const run of runs) {
    const result = await measureRun(searchconsole, siteUrl, run);
    if (!result) continue;
    const out = path.join(OUT_DIR, `${run.id}.json`);
    await fs.writeFile(out, JSON.stringify(result, null, 2) + "\n", "utf8");
    console.log(`${run.id}: ${result.checkpoints.map((c) => `${c.day}d=${c.status}`).join(" / ")}`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(String(error?.message || error).slice(0, 500));
    process.exit(1);
  });
}
