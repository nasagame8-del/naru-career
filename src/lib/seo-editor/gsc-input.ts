/**
 * Search Console データの正規化。
 *
 * 入力はサーバー側で取得した SCData（gsc-cache.ts 経由）のみ。
 * クライアントから渡された Search Console データは受け取らない。
 *
 * 既存の deriveQueryInsights() が前期比デルタと query→pages マップを
 * 計算済みなので、それをそのまま Phase 1 の入力に変換する。
 * 件数・数値の上限付けはここで行い、プロンプトへ載る量を抑える。
 */

import type { SCData, SCPeriodData, QueryInsight, SCRow } from "@/types/search-console";
import type { SeoTopicQuery } from "@/types/seo-editor";
import { DATA_THRESHOLDS, LIMITS } from "./config";
import { urlToSlug } from "./corpus";

export interface GscPeriodTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryRow extends SeoTopicQuery {
  /** そのクエリで表示されているページ（カニバリ判定の一次材料） */
  pages: { page: string; slug: string | null; impressions: number; position: number }[];
}

export interface GscPageRow {
  page: string;
  slug: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queries: { query: string; impressions: number; position: number }[];
}

export interface GscSnapshot {
  configured: boolean;
  error: string | null;
  totals: {
    current7d: GscPeriodTotals;
    previous7d: GscPeriodTotals;
    current28d: GscPeriodTotals;
    previous28d: GscPeriodTotals;
  };
  queries: GscQueryRow[];
  pages: GscPageRow[];
  /** データの薄さに関する警告。隠さずそのまま表示・プロンプトに渡す */
  dataWarnings: string[];
  lowData: boolean;
}

function n(value: unknown): number {
  const v = typeof value === "number" ? value : Number(value);
  return Number.isFinite(v) ? v : 0;
}

function nullableN(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

function s(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function totals(period: SCPeriodData | undefined): GscPeriodTotals {
  return {
    clicks: n(period?.clicks),
    impressions: n(period?.impressions),
    ctr: n(period?.ctr),
    position: n(period?.position),
  };
}

/** クライアント由来の値を SCData として最低限受け入れられるか判定する */
export function isScDataLike(value: unknown): value is SCData {
  return typeof value === "object" && value !== null && "configured" in value;
}

export function buildGscSnapshot(input: unknown): GscSnapshot {
  const empty: GscSnapshot = {
    configured: false,
    error: "Search Consoleデータが利用できません",
    totals: {
      current7d: totals(undefined),
      previous7d: totals(undefined),
      current28d: totals(undefined),
      previous28d: totals(undefined),
    },
    queries: [],
    pages: [],
    dataWarnings: ["Search Consoleデータが0件です。テーマ判断の根拠がありません"],
    lowData: true,
  };

  if (!isScDataLike(input)) return empty;
  const data = input as SCData;
  if (!data.configured) {
    return { ...empty, error: s(data.error) || "Search Consoleが未設定です" };
  }

  // ── クエリ行（queryInsights があればデルタ計算済みなので優先して使う） ──
  const insights: QueryInsight[] = Array.isArray(data.queryInsights) ? data.queryInsights : [];
  let queries: GscQueryRow[] = insights.map((qi) => ({
    query: s(qi.query),
    clicks: n(qi.clicks),
    impressions: n(qi.impressions),
    ctr: n(qi.ctr),
    position: n(qi.position),
    positionChange: nullableN(qi.positionChange),
    impressionChange: nullableN(qi.impressionChange),
    pages: (Array.isArray(qi.pages) ? qi.pages : []).slice(0, 5).map((p) => ({
      page: s(p.page),
      slug: urlToSlug(s(p.page)),
      impressions: n(p.impressions),
      position: n(p.position),
    })),
  }));

  // queryInsights が無い場合のフォールバック（current7d.topQueries）
  if (queries.length === 0) {
    const rows: SCRow[] = Array.isArray(data.current7d?.topQueries) ? data.current7d!.topQueries : [];
    queries = rows.map((r) => ({
      query: s(r.keys?.[0]),
      clicks: n(r.clicks),
      impressions: n(r.impressions),
      ctr: n(r.ctr),
      position: n(r.position),
      positionChange: null,
      impressionChange: null,
      pages: [],
    }));
  }

  queries = queries
    .filter((q) => q.query.length > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, LIMITS.maxQueryRows);

  // ── ページ行（28日間を基準。pageQueries でクエリを紐づける） ──
  const pageQueryMap = new Map<string, { query: string; impressions: number; position: number }[]>();
  const pageQueries: SCRow[] = Array.isArray(data.current28d?.pageQueries)
    ? data.current28d!.pageQueries
    : [];
  for (const row of pageQueries) {
    const page = s(row.keys?.[0]);
    const query = s(row.keys?.[1]);
    if (!page || !query) continue;
    const list = pageQueryMap.get(page) ?? [];
    list.push({ query, impressions: n(row.impressions), position: n(row.position) });
    pageQueryMap.set(page, list);
  }

  const pageRows: SCRow[] = Array.isArray(data.current28d?.topPages) ? data.current28d!.topPages : [];
  const pages: GscPageRow[] = pageRows
    .map((r) => {
      const page = s(r.keys?.[0]);
      return {
        page,
        slug: urlToSlug(page),
        clicks: n(r.clicks),
        impressions: n(r.impressions),
        ctr: n(r.ctr),
        position: n(r.position),
        queries: (pageQueryMap.get(page) ?? [])
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 8),
      };
    })
    .filter((p) => p.page.length > 0)
    .slice(0, LIMITS.maxPageRows);

  // ── データの薄さ評価 ──
  const dataWarnings: string[] = [];
  const imp28 = n(data.current28d?.impressions);
  if (queries.length === 0) {
    dataWarnings.push("直近期間の検索クエリが0件です。クエリ根拠のある判断はできません");
  }
  if (pages.length === 0) {
    dataWarnings.push("直近28日間に表示されたページが0件です");
  }
  if (imp28 > 0 && imp28 < DATA_THRESHOLDS.minImpressions28d) {
    dataWarnings.push(
      `直近28日間の総表示回数が${imp28}回と少なく、統計的な判断には不十分です`
    );
  }
  const thinQueries = queries.filter((q) => q.impressions < DATA_THRESHOLDS.minQueryImpressions).length;
  if (queries.length > 0 && thinQueries / queries.length > 0.7) {
    dataWarnings.push(
      `クエリの${Math.round((thinQueries / queries.length) * 100)}%が表示${DATA_THRESHOLDS.minQueryImpressions}回未満です。少数データを過大評価しないでください`
    );
  }

  const lowData =
    queries.length === 0 || imp28 < DATA_THRESHOLDS.minImpressions28d || dataWarnings.length >= 2;

  return {
    configured: true,
    error: s(data.error) || null,
    totals: {
      current7d: totals(data.current7d),
      previous7d: totals(data.previous7d),
      current28d: totals(data.current28d),
      previous28d: totals(data.previous28d),
    },
    queries,
    pages,
    dataWarnings,
    lowData,
  };
}

/**
 * 選択されたテーマに関連するページ候補をコード側で抽出する。
 * ここで絞り込むことで、全記事本文をLLMへ送らずに済む。
 */
export function pagesForQueries(snapshot: GscSnapshot, queries: string[]): string[] {
  const wanted = new Set(queries.map((q) => q.toLowerCase()));
  const slugs = new Set<string>();
  for (const q of snapshot.queries) {
    if (!wanted.has(q.query.toLowerCase())) continue;
    for (const p of q.pages) {
      if (p.slug) slugs.add(p.slug);
    }
  }
  for (const p of snapshot.pages) {
    if (!p.slug) continue;
    if (p.queries.some((pq) => wanted.has(pq.query.toLowerCase()))) slugs.add(p.slug);
  }
  return [...slugs];
}
