import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import type { ArticleMeta } from "@/lib/articles";
import { ArticleList } from "./ArticleList";

export function CategoryTabs({ articles }: { articles: ArticleMeta[] }) {
  return (
    <div>
      {/* カテゴリタブ — 横スクロール対応 */}
      <div className="relative">
        <div className="flex overflow-x-auto border-b border-line mb-6 scrollbar-hide">
          <span className="px-5 py-2.5 text-sm font-medium whitespace-nowrap text-accent relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent">
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
        {/* 右端フェード */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
      </div>

      <ArticleList articles={articles} />
    </div>
  );
}
