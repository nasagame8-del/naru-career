/**
 * Article Factory の明示的な型定義。
 *
 * ワークフロー境界（"use workflow" ↔ "use step"）を越えるデータは
 * すべてプレーンなJSONシリアライズ可能値でなければならない。
 * ここで定義する型はすべてその制約を満たす（関数・Symbol・クラスを含まない）。
 */

// ── 候補バッチ ──

export type CandidateRiskFlag =
  | "CANNIBALIZATION"
  | "OUT_OF_SCOPE"
  | "REQUIRES_PERSONAL_EXPERIENCE"
  | "TIME_SENSITIVE_CLAIMS"
  | "YMYL_SENSITIVE"
  | "THIN_DIFFERENTIATION"
  | "NO_SEARCH_EVIDENCE";

/** 検索意図の分類 */
export type SearchIntent = "know" | "do" | "compare" | "decide";

/** 無料SEOシグナルの候補選定評価。外部有料APIは前提にしない。 */
export type GscSignal = "strong" | "medium" | "weak" | "none";
export type SerpOpportunity = "high" | "medium" | "low" | "unchecked";
export type TrendSignal = "rising" | "stable" | "falling" | "unavailable";
export type DemandExpansionSignal = "high" | "medium" | "low" | "unavailable";
export type ClusterFitSignal = "strong" | "medium" | "weak";
export type CannibalizationRisk = "none" | "medium" | "high";
export type CandidateSelectionGrade = "A" | "B" | "C" | "D";

export interface CandidateSelectionEvidence {
  /** GSC実測。候補自身または関連クラスターの反応を段階評価する */
  gsc: GscSignal;
  /** Google検索結果上位の競合強度・検索意図の満たされ方 */
  serp: SerpOpportunity;
  /** Google Trends。取得不能なら unavailable のままにして推測しない */
  trends: TrendSignal;
  /** サジェスト・関連検索・PAAにある意味の異なる周辺需要 */
  demandExpansions: DemandExpansionSignal;
  /** 既存の優先クラスターと内部リンク網を強化できる度合い */
  clusterFit: ClusterFitSignal;
  /** 一次情報・求人票検証・時事公式資料など独自角度があるか */
  originalAngle: boolean;
  /** 既存記事との検索意図重複リスク */
  cannibalizationRisk: CannibalizationRisk;
  /** ISO8601 */
  checkedAt: string;
  /** 人間が読める根拠メモ。数値を取得していない項目は推測で埋めない */
  notes: string[];
}

export interface ArticleCandidate {
  /** バッチ内で一意。選択時にこのIDを指定する */
  id: string;
  title: string;
  /** 主要キーワード */
  primaryKeyword: string;
  /** 補助キーワード */
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  /** 既存記事との差分。「何が新しいのか」 */
  differenceFromExisting: string;
  /** いま書く理由 */
  reasonToWriteNow: string;
  /** 想定カテゴリ */
  category: string;
  /** 提案slug（英小文字・ハイフン） */
  proposedSlug: string;
  /** 機械判定・LLM判定で立ったリスクフラグ */
  riskFlags: CandidateRiskFlag[];
  /** 近いと判断された既存記事slug */
  nearestExistingSlugs: string[];
  /**
   * Search Console 由来の根拠。
   * データが無い場合は必ず null。**捏造しない**。
   */
  searchEvidence: SearchEvidence | null;
  /** GSC + 無料Webシグナルで採点した場合のみ保存する。未評価なら省略可。 */
  selectionEvidence?: CandidateSelectionEvidence;
  /** 0〜100。selectionEvidenceを点数化した結果。 */
  selectionScore?: number;
  selectionGrade?: CandidateSelectionGrade;
  /** 無料SEOシグナルの最低根拠ゲートを通ったか。 */
  selectionGatePassed?: boolean;
  /** この候補をそのまま実行してよいか（機械判定の結果） */
  blocked: boolean;
  /** blocked の理由。blocked が false なら空配列 */
  blockedReasons: string[];
}

export interface SearchEvidence {
  source: "search-console";
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  /** 集計期間（例 "28d"） */
  window: string;
}

export interface CandidateBatch {
  batchId: string;
  /** ISO8601 */
  generatedAt: string;
  /** "cron" | "manual" */
  trigger: "cron" | "manual";
  candidates: ArticleCandidate[];
  /** 生成時点の記事本数 */
  inventorySize: number;
  /** 次に採番される記事ID（リポジトリ在庫から算出） */
  nextArticleId: number;
  /** Search Console が利用できなかった場合の注記 */
  notes: string[];
}

// ── 選択されたトピック ──

export interface SelectedTopic {
  batchId: string;
  candidateId: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  category: string;
  slug: string;
  differenceFromExisting: string;
  reasonToWriteNow: string;
  articleId: number;
  /** 選択時刻 ISO8601 */
  selectedAt: string;
}

// ── ワークフローのフェーズ ──

export const ARTICLE_PHASES = [
  "inventory",
  "cannibalization",
  "research",
  "outline",
  "write",
  "internal-links",
  "image-plan",
  "qa",
  "create-pr",
  "pr-validation",
  "publish",
  "production-deploy",
] as const;

export type ArticlePhase = (typeof ARTICLE_PHASES)[number];

/** ダッシュボード表示用の日本語ラベル */
export const PHASE_LABELS: Record<ArticlePhase, string> = {
  inventory: "在庫確認",
  cannibalization: "重複チェック",
  research: "調査中",
  outline: "構成作成",
  write: "執筆",
  "internal-links": "内部リンク",
  "image-plan": "画像プラン",
  qa: "QA",
  "create-pr": "PR作成",
  "pr-validation": "PR検証（CI）",
  publish: "公開（マージ）",
  "production-deploy": "本番デプロイ",
};

export type PhaseState = "pending" | "running" | "done" | "failed" | "skipped";

/** ワークフローがストリームへ流す進捗イベント */
export interface PhaseProgressEvent {
  type: "phase";
  phase: ArticlePhase;
  state: PhaseState;
  /** 人間向けの短い説明 */
  message: string;
  /** ISO8601 */
  at: string;
}

/** 実行が安全に停止したことを伝えるイベント */
export interface BlockedEvent {
  type: "blocked";
  phase: ArticlePhase;
  /** 停止理由（人間が読める形） */
  reason: string;
  /** 機械可読な理由コード */
  code: string;
  at: string;
}

export interface CompletedEvent {
  type: "completed";
  prUrl: string | null;
  prNumber: number | null;
  productionUrl: string | null;
  published: boolean;
  at: string;
}

export type WorkflowEvent = PhaseProgressEvent | BlockedEvent | CompletedEvent;

// ── リサーチ ──

export interface ResearchSource {
  title: string;
  url: string;
  /** 取得日 YYYY-MM-DD */
  retrievedAt: string;
  /** この出典が支える主張 */
  supportsClaims: string[];
  /** 一次情報・公的機関かどうか */
  authoritative: boolean;
}

export interface ResearchResult {
  sources: ResearchSource[];
  /** 時事性があり出典が必要な主張 */
  timeSensitiveClaims: string[];
  /** 出典を確保できなかった主張。空でなければQAが止める */
  unsupportedClaims: string[];
}

// ── 構成 ──

export interface OutlineSection {
  heading: string;
  level: 2 | 3;
  /** この節で書くこと */
  intent: string;
  /** この節が依拠する出典URL */
  sourceUrls: string[];
}

export interface ArticleOutline {
  title: string;
  sections: OutlineSection[];
  /** 想定文字数 */
  targetChars: number;
}

// ── 記事ドラフト・変更セット ──

export interface ArticleFrontmatter {
  title: string;
  category: string;
  keyword: string;
  datePublished: string;
  dateModified: string;
  excerpt: string;
  summary: string[];
  faq: { question: string; answer: string }[];
  cta_agents: string[];
  note_published: boolean;
  naruPoint?: string;
}

export interface ArticleDraft {
  slug: string;
  frontmatter: ArticleFrontmatter;
  /** frontmatter を含まない本文Markdown */
  body: string;
  /** 本文に含めた内部リンクのパス */
  internalLinks: string[];
  charCount: number;
}

export type ChangeOperation = "CREATE";

export interface ArticleChange {
  path: string;
  operation: ChangeOperation;
  content: string;
}

// ── QA ──

export type QaVerdict = "PASS" | "NEEDS_REVIEW" | "FAIL";

export type QaCategory =
  | "cannibalization"
  | "frontmatter"
  | "internal-links"
  | "personal-experience"
  | "sources"
  | "paths"
  | "build"
  | "markdown"
  | "slug-collision"
  | "scope";

export interface QaIssue {
  category: QaCategory;
  verdict: QaVerdict;
  /** 対象（slug・パス・リンクなど） */
  target: string;
  message: string;
}

export interface QaResult {
  overall: QaVerdict;
  issues: QaIssue[];
  checkedAt: string;
}

// ── 公開 ──

export interface PublishResult {
  branch: string;
  prNumber: number;
  prUrl: string;
  /** PR head のコミットSHA。CIチェックはこのSHAに紐づく */
  headSha: string | null;
  /** マージコミットSHA。マージ後にのみ入る */
  mergeCommitSha: string | null;
  /**
   * **本番デプロイの成功を確認できた場合にのみ true**。
   * マージしただけでは true にしない。
   */
  published: boolean;
  /** 自動公開しなかった・できなかった理由 */
  publishBlockedReason: string | null;
  /** 本番デプロイ成功後にのみ入る */
  productionUrl: string | null;
}

// ── ワークフローの最終結果 ──

export interface ArticleRunResult {
  runId: string;
  slug: string;
  status: "completed" | "blocked" | "failed";
  /** 停止・失敗時の理由 */
  reason: string | null;
  qa: QaResult | null;
  publish: PublishResult | null;
}
