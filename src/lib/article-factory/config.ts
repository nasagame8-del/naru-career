/**
 * Article Factory（新規記事オートパイロット）の設定を集約する唯一の場所。
 *
 * SEO Editor（リライト用）とは独立したドメイン。
 * SEO Editor 側の設定・安全ゲートには一切手を入れない。
 */

/**
 * 純粋な定数は constants.ts に分離した（workflowサンドボックスへ
 * process.env 参照を持ち込まないため）。既存の import 経路は維持する。
 */
export {
  SITE_URL,
  ARTICLES_DIR,
  ARTICLE_RUN_DIR,
  CANDIDATE_BATCH_DIR,
  BRANCH_PREFIX,
  WAIT,
  TOPIC_SCOPE,
  LIMITS,
  ALLOWED_PERSONA_FACTS,
  REQUIRED_FRONTMATTER_KEYS,
  KNOWN_CATEGORIES,
} from "./constants";

/** 候補生成・執筆など高精度が必要な用途 */
export const ARTICLE_FACTORY_MODEL =
  process.env.ARTICLE_FACTORY_MODEL || process.env.SEO_EDITOR_MODEL || "gpt-5.5";

/** 整形・抽出など軽量な用途 */
export const ARTICLE_FACTORY_MODEL_LIGHT =
  process.env.ARTICLE_FACTORY_MODEL_LIGHT || ARTICLE_FACTORY_MODEL;

/** GitHub連携（SEO Editor と同じ env 名を再利用する） */
export const GITHUB_REPO = process.env.SEO_EDITOR_GITHUB_REPO || "nasagame8-del/naru-career";

/**
 * PRのベースブランチ。**既定値を持たない必須環境変数**。
 * SEO Editor と同じ方針で、未設定なら PR 作成を拒否する。
 */
export const GITHUB_BASE_BRANCH = process.env.SEO_EDITOR_BASE_BRANCH || "";

/**
 * 自動公開の境界。
 *
 * このインフラPRでは **既定で無効**。
 * すべてのQAゲートを通過し、かつサーバー側でこのフラグが明示的に
 * "true" に設定されている場合に限り自動マージを許可する。
 * 未設定・それ以外の値はすべて「自動公開しない」と解釈する。
 */
export function isAutoPublishAuthorized(): boolean {
  return process.env.ARTICLE_FACTORY_AUTO_PUBLISH === "true";
}

/** Vercel Cron 認証用のシークレット名（値は読まない・返さない） */
export const CRON_SECRET_ENV = "CRON_SECRET";
