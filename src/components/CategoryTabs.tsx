"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import type { ArticleMeta } from "@/lib/articles";
import { ArticleList } from "./ArticleList";

const INITIAL_COUNT = 6;

export function CategoryTabs({ articles }: { articles: ArticleMeta[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? articles : articles.slice(0, INITIAL_COUNT);
  const hasMore = articles.length > INITIAL_COUNT;

  return (
    <div>
      {/* カテゴリタブ */}
      <div className="relative">
        <div className="flex overflow-x-auto border-b border-line mb-6 scrollbar-hide">
          <span className="px-5 py-2.5 text-sm font-medium whitespace-nowrap text-primary relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary">
            すべて
          </span>
          {Object.entries(CATEGORIES).map(([slug, cat]) => (
            <Link
              key={slug}
              href={`/category/${slug}`}
              className="px-5 py-2.5 text-sm font-medium whitespace-nowrap text-ink-soft hover:text-ink transition-colors"
            >
              {cat.label}
            </Link>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
      </div>

      <ArticleList articles={displayed} />

      {/* さらに見る / 閉じる */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
          >
            {showAll ? (
              <>閉じる</>
            ) : (
              <>さらに見る（残り {articles.length - INITIAL_COUNT} 件）</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
