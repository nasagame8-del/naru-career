"use client";

import { useState } from "react";
import type { ArticleMeta } from "@/lib/articles";
import { ArticleList } from "./ArticleList";
import { MobileCareerCTA } from "./MobileCareerCTA";

const INITIAL_COUNT = 12;

export function CategoryTabs({ articles }: { articles: ArticleMeta[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? articles : articles.slice(0, INITIAL_COUNT);
  const hasMore = articles.length > INITIAL_COUNT;

  return (
    <div>
      <>
          <ArticleList articles={displayed.slice(0, 6)} priority />
          <MobileCareerCTA />
          {displayed.length > 6 && <div className="mt-6"><ArticleList articles={displayed.slice(6)} /></div>}
        </>

      {/* さらに見る / 閉じる */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 min-h-11 px-6 py-2.5 rounded-full border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
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
