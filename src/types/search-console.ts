/**
 * Search Console 関連の共通型定義
 *
 * サーバー（src/lib/search-console.ts）・APIレスポンス・クライアント
 * （DashboardClient.tsx）で共通利用する。型の重複定義を防ぐ。
 */

// ── 基本型 ──

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

// ── クエリインサイト ──

export type QuerySuggestionType =
  | "title_improve"
  | "content_strengthen"
  | "growing"
  | "new_query"
  | "high_rank_low_volume";

export interface QuerySuggestion {
  type: QuerySuggestionType;
  label: string;
}

export interface QueryInsight {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pages: { page: string; clicks: number; impressions: number; position: number }[];
  prevPosition: number | null;
  positionChange: number | null;
  prevImpressions: number | null;
  impressionChange: number | null;
  suggestion: QuerySuggestion | null;
}

// ── アクションアイテム ──

export interface EnhancedActionItem {
  page: string;
  slug: string;
  priority: "high" | "medium" | "low";
  reasons: string[];
  suggestions: string[];
  topQueries: { query: string; position: number; impressions: number; ctr: number }[];
}

// ── テーマ統計 ──

export interface ThemeStat {
  id: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  queryCount: number;
}

// ── 表示変化 ──

export interface SurgingPage {
  page: string;
  current: number;
  previous: number;
  changePercent: number;
  isNew: boolean;
}

export interface NewlyVisible {
  page: string;
  impressions: number;
}

// ── トップレベルデータ ──

export interface SCData {
  configured: boolean;
  error?: string;
  current7d?: SCPeriodData;
  previous7d?: SCPeriodData;
  current28d?: SCPeriodData;
  previous28d?: SCPeriodData;
  rewriteCandidates?: (SCRow & { priority: "high" | "medium" | "low" })[];
  lowCtrPages?: (SCRow & { priority: "high" | "medium" | "low" })[];
  surgingPages?: SurgingPage[];
  newlyVisible?: NewlyVisible[];
  actionItems?: string[];
  queryInsights?: QueryInsight[];
  enhancedActionItems?: EnhancedActionItem[];
  themeStats?: ThemeStat[];
}
