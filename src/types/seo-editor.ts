/**
 * NARU SEO Editor v1 — 共通型定義
 *
 * Client（DashboardのSEO Editorタブ）・API Route・lib層で共有する。
 * 型をコンポーネント側に重複定義しないこと。
 */

// ──────────────────────────────────────────
// Phase / Status
// ──────────────────────────────────────────

/** Phase 1〜9 の識別子。SeoRun.currentPhase・API の action に使う */
export type SeoPhaseId =
  | "topics" // PHASE 1 改善テーマ選定
  | "cannibalization" // PHASE 2 カニバリ監査
  | "cluster" // PHASE 3 Pillar / Cluster 監査
  | "action" // PHASE 4 新規 / リライト判断
  | "links" // PHASE 5 内部リンク設計
  | "brief" // PHASE 6 SEO Brief
  | "write" // PHASE 7 執筆 / リライト
  | "related" // PHASE 8 関連記事修正
  | "qa"; // PHASE 9 QA

export const SEO_PHASE_ORDER: SeoPhaseId[] = [
  "topics",
  "cannibalization",
  "cluster",
  "action",
  "links",
  "brief",
  "write",
  "related",
  "qa",
];

export const SEO_PHASE_LABELS: Record<SeoPhaseId, string> = {
  topics: "改善テーマ候補",
  cannibalization: "カニバリ監査",
  cluster: "クラスター監査",
  action: "編集方針",
  links: "内部リンク設計",
  brief: "SEO Brief",
  write: "記事生成 / リライト",
  related: "関連記事修正",
  qa: "QA",
};

export type SeoEditorStatus =
  | "idle" // テーマ未選択
  | "running" // Phase実行中
  | "completed" // Phase 9まで完了
  | "failed" // いずれかのPhaseで失敗
  | "published"; // PR作成済み（本番反映は人間のマージ）

export type SeoPhaseState = "pending" | "running" | "done" | "failed" | "skipped";

export interface SeoUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface SeoPhaseStatus {
  phase: SeoPhaseId;
  state: SeoPhaseState;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** そのPhaseで使ったモデル・トークン（コスト可視化用） */
  usage?: SeoUsage[];
}

/** 事実と推測を区別するための確度 */
export type Confidence = "low" | "medium" | "high";

// ──────────────────────────────────────────
// PHASE 1 — 改善テーマ候補
// ──────────────────────────────────────────

export type SeoTopicType =
  | "cluster_opportunity"
  | "rewrite_opportunity"
  | "cannibalization_risk"
  | "ctr_opportunity"
  | "new_demand";

export type SeoPossibleAction =
  | "rewrite"
  | "expand"
  | "new_article"
  | "internal_links"
  | "merge"
  | "title_meta";

export interface SeoTopicQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** 前期比。データが無ければ null */
  positionChange: number | null;
  impressionChange: number | null;
}

export interface SeoTopicCandidate {
  id: string;
  topic: string;
  type: SeoTopicType;
  reason: string;
  queries: SeoTopicQuery[];
  /** 関連する既存ページのURL（Search Console上のURL） */
  relatedPages: string[];
  possibleActions: SeoPossibleAction[];
  /** Search Consoleの実測値に基づく根拠。推測はcaveatsへ */
  evidence: string[];
  /** データの厚みに対する確度。impressionsが数件しかない場合はlow */
  dataConfidence: Confidence;
  /** 推測・留保事項（事実と分離する） */
  caveats: string[];
}

export interface SeoTopicSelection {
  candidates: SeoTopicCandidate[];
  /** データ全体の評価（少数データの警告など） */
  dataAssessment: string;
  lowDataWarning: boolean;
}

// ──────────────────────────────────────────
// PHASE 2 — カニバリ監査
// ──────────────────────────────────────────

export type CannibalizationStatus =
  | "NO_CONFLICT"
  | "INTENT_OVERLAP"
  | "STRONG_CANNIBALIZATION"
  | "MERGE_CANDIDATE"
  | "ROLE_CLARIFICATION_NEEDED";

export interface CannibalizationPage {
  slug: string;
  url: string;
  title: string;
  /** そのページが実際に答えている検索意図 */
  searchIntent: string;
  targetReader: string;
  /** クラスター内でのこのページの役割 */
  role: string;
  sharedQueries: string[];
}

export interface CannibalizationAudit {
  status: CannibalizationStatus;
  pages: CannibalizationPage[];
  reason: string;
  /** ページ間の意図の違い。ここが埋まるほどカニバリではない */
  intentDifferences: string[];
  recommendedAction: string;
  confidence: Confidence;
  /** 本文まで読み込んだslug（コスト追跡） */
  inspectedSlugs: string[];
}

// ──────────────────────────────────────────
// PHASE 3 — Pillar / Cluster 監査
// ──────────────────────────────────────────

export type ClusterRole = "pillar" | "cluster" | "supporting";

export interface ClusterNode {
  slug: string;
  url: string;
  title: string;
  role: ClusterRole;
  /** このテーマをどの程度カバーできているか */
  coverage: "full" | "partial" | "thin";
  note: string;
}

export interface MissingTopic {
  topic: string;
  searchIntent: string;
  /** 既存記事で回答可能ならそのslug。nullなら既存では回答不能 */
  canBeCoveredBy: string | null;
  /** 独立ページとして存在する意味があるか。falseなら新規記事にしない */
  independentPageJustified: boolean;
  reason: string;
}

export interface ClusterAudit {
  pillar: {
    status: "existing" | "candidate" | "missing";
    /** 既存Pillarのパス（/guides/... または /articles/...）。missingならnull */
    url: string | null;
    title: string;
    reason: string;
  };
  nodes: ClusterNode[];
  missingTopics: MissingTopic[];
  notes: string[];
  confidence: Confidence;
}

// ──────────────────────────────────────────
// PHASE 4 — 新規 / リライト判断
// ──────────────────────────────────────────

export type SeoActionType = "KEEP" | "REWRITE" | "EXPAND" | "CREATE" | "MERGE";

export interface ActionDecisionItem {
  /** 既存記事はslug、CREATEは新規slug案 */
  target: string;
  targetType: "article" | "new_article" | "guide";
  action: SeoActionType;
  reason: string;
  evidence: string[];
  risk: string;
  /** MERGE時の統合先slug */
  mergeInto: string | null;
  /** EXPAND時に追加したいテーマ */
  expandTopics: string[];
}

export interface ActionDecision {
  decisions: ActionDecisionItem[];
  summary: string;
  /** コード側で検証した警告（例: 既存記事で回答可能なのにCREATEしている） */
  warnings: string[];
}

// ──────────────────────────────────────────
// PHASE 5 — 内部リンク設計
// ──────────────────────────────────────────

export type LinkOperation = "ADD" | "UPDATE" | "REMOVE";

export interface InternalLink {
  source: string;
  target: string;
  placement: string;
  anchor: string;
  reason: string;
  operation: LinkOperation;
}

export interface InternalLinkPlan {
  links: InternalLink[];
  notes: string[];
  /** コード側の検証で除外したリンク（存在しないURL等） */
  rejected: { link: InternalLink; reason: string }[];
}

// ──────────────────────────────────────────
// PHASE 6 — SEO Brief
// ──────────────────────────────────────────

export interface ResearchSource {
  url: string;
  title: string;
  retrievedAt: string;
  usedFor: string;
}

export interface SeoBrief {
  target: string;
  action: SeoActionType;
  primaryIntent: string;
  targetReader: string;
  roleInCluster: string;
  mustAnswer: string[];
  recommendedHeadings: string[];
  /** experience-notes.md に実在する一次体験のみ */
  firstPartyEvidence: string[];
  internalLinksIn: InternalLink[];
  internalLinksOut: InternalLink[];
  /** 既存記事から必ず残す要素 */
  preserve: string[];
  /** 絶対に創作してはいけないもの */
  doNotInvent: string[];
  /** 外部調査を使った場合の出典 */
  sources: ResearchSource[];
}

// ──────────────────────────────────────────
// PHASE 7 / 8 — 変更セット
// ──────────────────────────────────────────

export type ChangeOperation = "CREATE" | "UPDATE" | "DELETE";

export interface ArticleChange {
  path: string;
  operation: ChangeOperation;
  /** 既存内容。CREATEならnull */
  before: string | null;
  after: string;
  reason: string;
  /** どのPhaseが生成したか */
  phase: SeoPhaseId;
  /** リライト時に保持を宣言した一次体験の断片 */
  preservedSegments: string[];
  /** コード側の保持検証で失敗した断片 */
  lostSegments: string[];
  /** 人間の判断が必要（MERGEの統合元記事など） */
  needsHumanDecision: boolean;
  note: string;
}

// ──────────────────────────────────────────
// PHASE 9 — QA
// ──────────────────────────────────────────

export type QaCategory =
  | "FACT"
  | "EXPERIENCE"
  | "SEARCH_INTENT"
  | "CANNIBALIZATION"
  | "INTERNAL_LINK"
  | "BROKEN_LINK"
  | "FRONTMATTER"
  | "DUPLICATION";

/** WARNING は報告するが publish をブロックしない */
export type QaVerdict = "PASS" | "WARNING" | "NEEDS_REVIEW" | "FAIL";

/**
 * その問題を「今回のChange Setが発生・悪化させたか」。
 * QAゲートの基準は問題の存在ではなく、この分類である。
 */
export type QaOrigin =
  | "INTRODUCED" // 今回の変更で新規発生 → FAIL
  | "REGRESSED" // 今回の変更で既存状態を悪化 → FAIL
  | "PRE_EXISTING" // 変更前から存在し、今回触っていない → WARNING
  | "UNKNOWN"; // 帰属を判定できない → NEEDS_REVIEW

export interface QaIssue {
  category: QaCategory;
  verdict: QaVerdict;
  origin: QaOrigin;
  target: string;
  location: string;
  message: string;
  evidence: string;
  /** proofread.js 由来の分類（FACT/EXPERIENCE時のみ） */
  factCategory?: "CONTRADICTION" | "UNSUPPORTED" | "AMBIGUOUS";
}

export interface QaResult {
  overall: QaVerdict;
  issues: QaIssue[];
  summary: string;
  /** カテゴリ別の判定 */
  byCategory: Partial<Record<QaCategory, QaVerdict>>;
}

// ──────────────────────────────────────────
// 公開（PR）
// ──────────────────────────────────────────

export interface SeoPublishResult {
  branch: string;
  commitSha: string;
  prNumber: number;
  prUrl: string;
  baseBranch: string;
  createdAt: string;
  /** VercelのGit連携が無い場合の注意書き */
  previewNote: string | null;
}

// ──────────────────────────────────────────
// SeoRun — 1回のSEO改善処理
// ──────────────────────────────────────────

export interface SeoRun {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SeoEditorStatus;
  currentPhase: SeoPhaseId;
  phases: SeoPhaseStatus[];

  /** PHASE 1 の候補一覧 */
  selection: SeoTopicSelection | null;
  /** 人間が選んだ1テーマ */
  selectedTopic: SeoTopicCandidate | null;

  cannibalization: CannibalizationAudit | null;
  clusterAudit: ClusterAudit | null;
  actionDecision: ActionDecision | null;
  internalLinks: InternalLinkPlan | null;
  briefs: SeoBrief[];
  changes: ArticleChange[];
  qa: QaResult | null;

  research: ResearchSource[];
  publish: SeoPublishResult | null;
  /** 合計トークン使用量 */
  usage: SeoUsage[];
  /** データが弱い場合の警告（隠さず表示する） */
  warnings: string[];
}

// ──────────────────────────────────────────
// API I/O
// ──────────────────────────────────────────

/**
 * クライアントが送るのは操作情報と、サーバーが署名した直前のRunだけ。
 * Search Consoleデータはサーバー側で取得する（クライアントからは受け取らない）。
 */
export interface SeoEditorRequest {
  action: SeoPhaseId;
  /** 直前のレスポンスで受け取った署名付きRun。Phase 1では null */
  signedRun: SignedRun | null;
  /** PHASE 2 の入口: 人間が選んだ候補ID */
  topicId?: string;
  /** PHASE 6〜8: 対象を1件ずつ処理するためのインデックス */
  index?: number;
  /** PHASE 1: サーバーキャッシュを無視してGSCを再取得する */
  refreshGsc?: boolean;
}

/**
 * サーバーがHMACで署名したRun。
 * クライアントはこれをそのまま保持・返送するだけで、中身を編集しても
 * 署名検証で弾かれるため、改ざんされたPhase結果で先へ進めない。
 */
export interface SignedRun {
  run: SeoRun;
  /** サーバー側のみが生成・検証できる署名 */
  signature: string;
}

export interface SeoEditorResponse {
  ok: boolean;
  signedRun: SignedRun;
  /** そのPhaseでまだ処理すべき対象が残っているか（index方式のPhase用） */
  hasMore?: boolean;
  nextIndex?: number;
  /** PHASE 1 のGSCがキャッシュ由来か（API呼び出しの可視化） */
  gscFromCache?: boolean;
  error?: string;
  failedPhase?: SeoPhaseId;
}
