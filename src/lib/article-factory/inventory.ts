/**
 * 記事在庫の読み取り。
 *
 * SEO Editor の corpus.ts を再利用し、新規記事オートパイロットが必要とする
 * 形（重複判定用の最小情報・次の記事ID・実在する内部リンク先）へ変換する。
 *
 * 既存のcorpusには手を入れない。
 */

import { getArticleIndex, getKnownPathnames } from "@/lib/seo-editor/corpus";
import type { ExistingArticleRef } from "./safety";

export interface ArticleInventory {
  /** 重複判定に使う既存記事の最小情報 */
  existing: ExistingArticleRef[];
  /** 既存slugの一覧（上書き拒否に使う） */
  existingSlugs: string[];
  /** 記事本数 */
  size: number;
  /** 次に採番される記事ID */
  nextArticleId: number;
  /** 内部リンク先として実在が保証されるパス */
  knownPaths: string[];
}

/**
 * 記事IDの決定。
 *
 * NARUの記事Markdownには数値IDのfrontmatterが存在しないため、
 * リポジトリ在庫の本数を根拠に「最大ID = 本数」とみなし、+1 を返す。
 * Drive側に別のID体系がある場合はそちらが正本であり、
 * この値は突き合わせ用の提案値として扱うこと。
 */
export function computeNextArticleId(size: number): number {
  return size + 1;
}

/** リポジトリから現在の記事在庫を読み出す */
export function readInventory(): ArticleInventory {
  const index = getArticleIndex();
  const existing: ExistingArticleRef[] = index.map((e) => ({
    slug: e.slug,
    title: e.title,
    keyword: e.keyword,
  }));

  return {
    existing,
    existingSlugs: existing.map((e) => e.slug),
    size: existing.length,
    nextArticleId: computeNextArticleId(existing.length),
    knownPaths: [...getKnownPathnames()],
  };
}

/**
 * プロンプトへ載せる軽量な在庫表。
 * 本文は載せない（コスト対策）。
 */
export function compactInventory(inv: ArticleInventory) {
  return inv.existing.map((e) => ({
    slug: e.slug,
    title: e.title,
    keyword: e.keyword,
  }));
}
