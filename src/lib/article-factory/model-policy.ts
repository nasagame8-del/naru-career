/**
 * Article Factory のモデル振り分け（純粋関数）。
 *
 * 高価な高精度モデルは本文執筆に限定し、それ以外は軽量モデルを使う。
 * process.env は config.ts だけで読み、このモジュールはテスト可能な純粋実装に保つ。
 */

export const DEFAULT_ARTICLE_FACTORY_MODEL = "gpt-5.5";
export const DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT = "gpt-5-mini";

export interface ArticleFactoryModelEnv {
  ARTICLE_FACTORY_MODEL?: string;
  ARTICLE_FACTORY_MODEL_LIGHT?: string;
  ARTICLE_FACTORY_MODEL_RESEARCH?: string;
  SEO_EDITOR_MODEL?: string;
}

export interface ArticleFactoryModels {
  /** 本文執筆など、品質を最優先する処理 */
  primary: string;
  /** 候補・構成・抽出・修復案などの軽量処理 */
  light: string;
  /** Web検索と主張マッピング */
  research: string;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveArticleFactoryModels(
  env: ArticleFactoryModelEnv
): ArticleFactoryModels {
  const primary =
    nonEmpty(env.ARTICLE_FACTORY_MODEL) ??
    nonEmpty(env.SEO_EDITOR_MODEL) ??
    DEFAULT_ARTICLE_FACTORY_MODEL;
  const light =
    nonEmpty(env.ARTICLE_FACTORY_MODEL_LIGHT) ??
    DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT;
  const research =
    nonEmpty(env.ARTICLE_FACTORY_MODEL_RESEARCH) ?? light;

  return { primary, light, research };
}
