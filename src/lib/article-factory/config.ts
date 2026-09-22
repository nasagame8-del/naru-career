/**
 * Article Factory（新規記事オートパイロット）の設定を集約する唯一の場所。
 *
 * SEO Editor（リライト用）とは独立したドメイン。
 * SEO Editor 側の設定・安全ゲートには一切手を入れない。
 */

/** 候補生成・執筆など高精度が必要な用途 */
export const ARTICLE_FACTORY_MODEL =
  process.env.ARTICLE_FACTORY_MODEL || process.env.SEO_EDITOR_MODEL || "gpt-5.5";

/** 整形・抽出など軽量な用途 */
export const ARTICLE_FACTORY_MODEL_LIGHT =
  process.env.ARTICLE_FACTORY_MODEL_LIGHT || ARTICLE_FACTORY_MODEL;

export const SITE_URL = "https://naru-career.com";

/** GitHub連携（SEO Editor と同じ env 名を再利用する） */
export const GITHUB_REPO = process.env.SEO_EDITOR_GITHUB_REPO || "nasagame8-del/naru-career";

/**
 * PRのベースブランチ。**既定値を持たない必須環境変数**。
 * SEO Editor と同じ方針で、未設定なら PR 作成を拒否する。
 */
export const GITHUB_BASE_BRANCH = process.env.SEO_EDITOR_BASE_BRANCH || "";

/** 記事ソースの配置先 */
export const ARTICLES_DIR = "content/articles";

/** Run の記録・image-plan の保存先（PRブランチ内） */
export const ARTICLE_RUN_DIR = "data/article-runs";

/** 候補バッチの保存先（ストレージアダプタが GitHub の場合） */
export const CANDIDATE_BATCH_DIR = "data/article-candidates";

/** PRブランチ名の接頭辞 */
export const BRANCH_PREFIX = "article-factory";

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

/**
 * 外部CI・本番デプロイの待ち時間。
 *
 * Workflow の sleep() は実行リソースを消費せずに待てるため、
 * 分単位で待っても問題ない。
 */
export const WAIT = {
  /** 必須チェックのポーリング間隔 */
  checkPollInterval: "30s",
  /** 必須チェックの完了を待つ上限（ミリ秒） */
  checkTimeoutMs: 20 * 60 * 1000,
  /**
   * 必須チェックが登録されるまでの猶予（ミリ秒）。
   * この間にチェックが現れなければ missing とみなす。
   */
  checkAppearanceGraceMs: 3 * 60 * 1000,
  /** 本番デプロイのポーリング間隔 */
  deployPollInterval: "30s",
  /** 本番デプロイの完了を待つ上限（ミリ秒） */
  deployTimeoutMs: 20 * 60 * 1000,
} as const;

/** サイトのテーマ境界。これを外れる候補は機械的に落とす */
export const TOPIC_SCOPE = {
  label: "第二新卒 × IT/Web転職",
  /** いずれか1つ以上を含まない候補はスコープ外とみなす */
  requiredAnyOf: [
    "第二新卒",
    "既卒",
    "転職",
    "就活",
    "内定",
    "面接",
    "職務経歴書",
    "履歴書",
    "退職",
    "エージェント",
    "IT",
    "Web",
    "エンジニア",
    "未経験",
    "年収",
    "キャリア",
  ],
  /** これらを含む候補は明確にスコープ外 */
  forbidden: [
    "投資",
    "仮想通貨",
    "FX",
    "パチンコ",
    "ギャンブル",
    "アダルト",
    "医療広告",
    "副業詐欺",
    "宗教",
    "政治",
  ],
} as const;

/** コスト・暴走対策の上限 */
export const LIMITS = {
  /** 1バッチの候補数（下限・上限） */
  minCandidates: 3,
  maxCandidates: 5,
  /** カニバリ判定で本文まで読む記事数 */
  maxBodiesForCannibalization: 6,
  /** 本文をプロンプトへ載せる際の1記事あたり文字数上限 */
  maxBodyChars: 7000,
  /** 1 Run で作成・変更できるファイル数の上限 */
  maxChanges: 6,
  /** 内部リンクの上限 */
  maxInternalLinks: 12,
  /** 記事本文の最低文字数（極端に短い生成を落とす） */
  minArticleChars: 2000,
  /** リサーチで保持する出典数の上限 */
  maxSources: 12,
} as const;

/**
 * 著者ペルソナとして表明してよい一次情報。
 * **この範囲を超える一人称の実体験は生成も公開も禁止**。
 */
export const ALLOWED_PERSONA_FACTS = [
  "磯貝アルト",
  "24歳",
  "飲食業界で1年勤務",
  "第二新卒でIT/Web業界へ転職",
  "応募社数は約30社",
  "内定2社",
  "年収350万円から400万円へ",
  "現職はAIO対策企業の法人営業",
] as const;

/** 記事frontmatterで必須のキー（既存記事37本すべてが持つもの） */
export const REQUIRED_FRONTMATTER_KEYS = [
  "title",
  "category",
  "keyword",
  "datePublished",
  "dateModified",
  "excerpt",
  "summary",
  "faq",
  "cta_agents",
  "note_published",
] as const;

/** 既存記事で使われているカテゴリ */
export const KNOWN_CATEGORIES = ["業界解説", "体験談", "エージェント比較"] as const;
