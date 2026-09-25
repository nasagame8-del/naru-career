/**
 * 記事一覧の並び替え（純粋関数のみ）。
 *
 * ネットワーク・ファイルI/O・process.env に依存しない。
 * 「どの順に並ぶか」の判断をここへ集約し、テストで固定する。
 */

import { CATEGORIES } from "./categories";
import type { ArticleMeta } from "./articles";

export const SORT_OPTIONS = [
  { id: "newest", label: "新しい順" },
  { id: "popular", label: "人気順" },
  { id: "recommended", label: "おすすめ順" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export function isSortId(value: string): value is SortId {
  return SORT_OPTIONS.some((o) => o.id === value);
}

/** 公開日の降順。同日は slug で安定させる */
export function sortByNewest(articles: ArticleMeta[]): ArticleMeta[] {
  return [...articles].sort((a, b) => {
    const diff =
      new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime();
    if (diff !== 0) return diff;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * 人気順。
 *
 * `order` は Search Console のスナップショット（人気の高い順に並んだslug）。
 * スナップショットに載っていない記事は順位不明なので、
 * **載っている記事の後ろに新しい順で続ける**（勝手に上位へ混ぜない）。
 *
 * order が空（スナップショット未生成）の場合は実質新しい順になる。
 */
export function sortByPopularity(
  articles: ArticleMeta[],
  order: string[]
): ArticleMeta[] {
  const rank = new Map<string, number>();
  order.forEach((slug, i) => {
    if (!rank.has(slug)) rank.set(slug, i);
  });

  const ranked: ArticleMeta[] = [];
  const unranked: ArticleMeta[] = [];
  for (const article of articles) {
    if (rank.has(article.slug)) ranked.push(article);
    else unranked.push(article);
  }

  ranked.sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  return [...ranked, ...sortByNewest(unranked)];
}

/**
 * カテゴリ定義の `readingOrder` を、定義順に連結した推奨順のslug列。
 *
 * 同じslugが複数カテゴリに現れても最初の1回だけ採用する。
 */
export function recommendedSlugOrder(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of Object.values(CATEGORIES)) {
    for (const slug of cat.readingOrder) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

/**
 * おすすめ順。
 *
 * 編集部が `readingOrder` で示した順番を最優先し、
 * そこに載っていない記事は後ろへ新しい順で続ける。
 * 追加のデータを必要としない。
 */
export function sortByRecommended(
  articles: ArticleMeta[],
  order: string[] = recommendedSlugOrder()
): ArticleMeta[] {
  const rank = new Map<string, number>();
  order.forEach((slug, i) => {
    if (!rank.has(slug)) rank.set(slug, i);
  });

  const ranked: ArticleMeta[] = [];
  const unranked: ArticleMeta[] = [];
  for (const article of articles) {
    if (rank.has(article.slug)) ranked.push(article);
    else unranked.push(article);
  }

  ranked.sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  return [...ranked, ...sortByNewest(unranked)];
}

/** 指定された並び順を適用する */
export function sortArticles(
  articles: ArticleMeta[],
  sort: SortId,
  options: { popularityOrder?: string[]; recommendedOrder?: string[] } = {}
): ArticleMeta[] {
  switch (sort) {
    case "popular":
      return sortByPopularity(articles, options.popularityOrder ?? []);
    case "recommended":
      return sortByRecommended(articles, options.recommendedOrder);
    case "newest":
    default:
      return sortByNewest(articles);
  }
}
