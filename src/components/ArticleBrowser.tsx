"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import type { ArticleMeta } from "@/lib/articles";
import { ArticleList } from "./ArticleList";
import {
  SORT_OPTIONS,
  sortArticles,
  type SortId,
} from "@/lib/article-sort";

/** 最初に表示する件数。「さらに見る」で全件へ広げる */
const INITIAL_COUNT = 12;

/** 「すべて」を含むフィルタの識別子 */
const ALL = "all" as const;

type FilterId = typeof ALL | ArticleMeta["category"];

/** カテゴリ名 → SEO用カテゴリページのslug（存在するものだけ） */
const CATEGORY_SLUG_BY_NAME = new Map<string, string>(
  Object.entries(CATEGORIES).map(([slug, cat]) => [cat.name, slug])
);

/**
 * 記事をカテゴリで絞り込み、並び順を選んで閲覧する。
 *
 * 並び順の判定は `@/lib/article-sort` の純粋関数に委ねる。
 * 根拠データが無い並び順（スナップショット未生成時の人気順）は
 * 選択肢に出さない。
 */
export function ArticleBrowser({
  articles,
  popularityOrder = [],
  recommendedOrder,
}: {
  articles: ArticleMeta[];
  /** 人気順のslug列。空なら「人気順」は選択肢に出さない */
  popularityOrder?: string[];
  /** おすすめ順のslug列 */
  recommendedOrder?: string[];
}) {
  const [filter, setFilter] = useState<FilterId>(ALL);
  const [sort, setSort] = useState<SortId>("newest");
  const [showAll, setShowAll] = useState(false);

  // 根拠データが無い並び順は出さない（実態と違う順序を見せない）
  const availableSorts = useMemo(
    () => SORT_OPTIONS.filter((o) => o.id !== "popular" || popularityOrder.length > 0),
    [popularityOrder]
  );

  /** カテゴリごとの件数。タブに出して選ぶ前に規模が分かるようにする */
  const counts = useMemo(() => {
    const map = new Map<FilterId, number>([[ALL, articles.length]]);
    for (const article of articles) {
      map.set(article.category, (map.get(article.category) ?? 0) + 1);
    }
    return map;
  }, [articles]);

  /** 実際に存在するカテゴリだけをタブに出す（0件タブを作らない） */
  const tabs = useMemo(() => {
    const present = Object.values(CATEGORIES)
      .map((cat) => cat.name)
      .filter((name) => (counts.get(name) ?? 0) > 0);
    return [ALL, ...present] as FilterId[];
  }, [counts]);

  const filtered = useMemo(() => {
    const scoped =
      filter === ALL ? articles : articles.filter((a) => a.category === filter);
    return sortArticles(scoped, sort, { popularityOrder, recommendedOrder });
  }, [articles, filter, sort, popularityOrder, recommendedOrder]);

  const displayed = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);
  const remaining = filtered.length - displayed.length;

  function selectFilter(next: FilterId) {
    setFilter(next);
    // 絞り込みを変えたら表示件数も初期状態へ戻す
    setShowAll(false);
  }

  function selectSort(next: SortId) {
    setSort(next);
    // 並び順を変えたら先頭から見せる
    setShowAll(false);
  }

  const activeSortLabel =
    availableSorts.find((o) => o.id === sort)?.label ?? "新しい順";

  const activeCategorySlug =
    filter === ALL ? null : (CATEGORY_SLUG_BY_NAME.get(filter) ?? null);

  return (
    <div>
      {/* カテゴリタブ（ページ遷移せずその場で切り替える） */}
      <div className="relative">
        <div
          role="tablist"
          aria-label="記事のカテゴリ"
          className="flex overflow-x-auto border-b border-line mb-6 scrollbar-hide"
        >
          {tabs.map((tab) => {
            const isActive = tab === filter;
            const label = tab === ALL ? "すべて" : tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectFilter(tab)}
                className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  isActive
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {label}
                <span className="ml-1.5 font-mono text-[11px] text-ink-soft">
                  {counts.get(tab) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
      </div>

      {/* 並び替え */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-ink-soft">並び替え</span>
        <div role="group" aria-label="並び替え" className="flex flex-wrap gap-1.5">
          {availableSorts.map((option) => {
            const isActive = option.id === sort;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => selectSort(option.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line text-ink-soft hover:text-ink hover:border-ink-soft"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 件数と現在の並び順を明示する */}
      <p className="text-xs text-ink-soft mb-4">
        {filter === ALL ? "すべての記事" : filter}を{activeSortLabel}に
        {filtered.length}件表示しています
        {remaining > 0 ? `（うち${displayed.length}件を表示中）` : ""}
      </p>

      {displayed.length > 0 ? (
        <ArticleList articles={displayed} />
      ) : (
        <p className="py-10 text-center text-sm text-ink-soft">
          このカテゴリの記事はまだありません。
        </p>
      )}

      {remaining > 0 && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
          >
            さらに見る（残り {remaining} 件）
          </button>
        </div>
      )}

      {showAll && filtered.length > INITIAL_COUNT && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
          >
            閉じる
          </button>
        </div>
      )}

      {/* カテゴリ解説ページへの導線（SEOページへの内部リンクを維持する） */}
      {activeCategorySlug && (
        <div className="mt-8 pt-6 border-t border-line">
          <Link
            href={`/category/${activeCategorySlug}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            「{filter}」カテゴリの解説と読む順番を見る →
          </Link>
        </div>
      )}
    </div>
  );
}
