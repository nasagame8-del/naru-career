/**
 * SEO Editor の設定を集約する唯一の場所。
 * モデル名を各所にハードコードしないこと。
 */

/** 高精度が必要なPhase（カニバリ/クラスター/判断/Brief/執筆/QA）用 */
export const SEO_EDITOR_MODEL =
  process.env.SEO_EDITOR_MODEL || process.env.OPENAI_PROOFREAD_MODEL || "gpt-5.5";

/**
 * データ整形・リンク候補抽出など比較的軽量な用途。
 * v1では既定値を高精度モデルと同一にしておき、分離はenvだけで可能にする。
 */
export const SEO_EDITOR_MODEL_LIGHT = process.env.SEO_EDITOR_MODEL_LIGHT || SEO_EDITOR_MODEL;

export const SITE_URL = "https://naru-career.com";

/** Search Console データのサーバー側キャッシュTTL（既定30分） */
export const GSC_CACHE_TTL_MS = Number(process.env.SEO_EDITOR_GSC_CACHE_TTL_MS || 30 * 60 * 1000);

/** GitHub連携（Tokenはサーバー側のみ。Clientへ一切返さない） */
export const GITHUB_REPO = process.env.SEO_EDITOR_GITHUB_REPO || "nasagame8-del/naru-career";

/**
 * PRのベースブランチ。**既定値を持たない必須環境変数**。
 * master と work が大きく乖離している現状を暗黙の仕様にしないため、
 * 未設定なら PR 作成そのものを拒否する。
 */
export const GITHUB_BASE_BRANCH = process.env.SEO_EDITOR_BASE_BRANCH || "";

/** SeoRunの保存先（PRブランチ内のパス） */
export const SEO_RUN_DIR = "data/seo-runs";

/** コスト対策の上限 */
export const LIMITS = {
  /** PHASE 1 に渡すクエリ行の上限 */
  maxQueryRows: 40,
  /** PHASE 1 に渡すページ行の上限 */
  maxPageRows: 25,
  /** PHASE 2 で本文まで読み込む記事数の上限 */
  maxBodiesForCannibalization: 6,
  /** 本文をプロンプトへ載せる際の1記事あたり文字数上限 */
  maxBodyChars: 7000,
  /** PHASE 1 の候補数上限 */
  maxTopicCandidates: 5,
  /** 1 Run で生成・更新できるファイル数の上限（暴走防止） */
  maxChanges: 12,
  /** 内部リンク計画の上限 */
  maxLinks: 20,
} as const;

/**
 * 少数データを過大評価しないための閾値。
 * これを下回る場合は lowDataWarning を立て、確度を下げる。
 */
export const DATA_THRESHOLDS = {
  /** テーマとして扱うのに最低限欲しい28日間の表示回数 */
  minImpressions28d: 20,
  /** 1クエリを根拠として扱うのに最低限欲しい表示回数 */
  minQueryImpressions: 5,
} as const;
