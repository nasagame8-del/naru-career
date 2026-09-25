import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticleMetas } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";
import { ArticleBrowser } from "@/components/ArticleBrowser";
import { readPopularitySnapshot } from "@/lib/popularity";
import { recommendedSlugOrder } from "@/lib/article-sort";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "記事一覧",
  description:
    "第二新卒のIT/Web転職に関する記事を新しい順に一覧できます。体験談・エージェント比較・業界解説のカテゴリで絞り込んで探せます。",
  alternates: {
    canonical: "/articles",
  },
};

export default function ArticlesIndexPage() {
  // getAllArticleMetas() は公開日の降順（最新順）で返る
  const articles = getAllArticleMetas();
  // 人気順はビルド時スナップショットから読む（公開ページからAPIを呼ばない）
  const popularity = readPopularitySnapshot();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "記事一覧", href: "/articles" },
        ]}
      />

      <main className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <nav aria-label="パンくず" className="text-xs text-ink-soft mb-4">
          <Link href="/" className="hover:text-ink transition-colors">
            ホーム
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink">記事一覧</span>
        </nav>

        <h1 className="text-2xl font-bold mb-2">記事一覧</h1>
        <p className="text-sm text-ink-soft mb-8">
          第二新卒のIT/Web転職に関する記事を新しい順に掲載しています。
          カテゴリタブで絞り込めます。
        </p>

        <ArticleBrowser
          articles={articles}
          popularityOrder={popularity?.order ?? []}
          recommendedOrder={recommendedSlugOrder()}
        />

        {/* カテゴリ解説ページへの導線（内部リンクを保つ） */}
        <section className="mt-12 pt-8 border-t border-line">
          <h2 className="text-base font-bold mb-3">カテゴリごとの解説</h2>
          <p className="text-sm text-ink-soft mb-4">
            各カテゴリには、読む順番つきの解説ページがあります。
          </p>
          <ul className="flex flex-wrap gap-3">
            {Object.entries(CATEGORIES).map(([slug, cat]) => (
              <li key={slug}>
                <Link
                  href={`/category/${slug}`}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
