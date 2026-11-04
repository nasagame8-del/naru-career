import Link from "next/link";
import Image from "next/image";
import type { ArticleMeta } from "@/lib/articles";
import { getCategoryTheme } from "@/lib/categories";

export function ArticleList({ articles, priority = false, readingOrder }: { articles: ArticleMeta[]; priority?: boolean; readingOrder?: string[] }) {
  return (
    <div className="article-grid">
      {articles.map((article, index) => (
        <Link key={article.slug} href={`/articles/${article.slug}`} className="article-card group">
          <div className="aspect-card relative bg-bg-soft overflow-hidden">
            {article.cardImagePath ? (
              <Image src={article.cardImagePath}
                alt={`${article.title}｜${article.category}記事のサムネイル画像`}
                fill className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                sizes="(min-width: 1240px) 293px, (min-width: 1200px) 24vw, (min-width: 1024px) 33vw, (min-width: 640px) 46vw, calc(100vw - 40px)"
                priority={priority && index < 3} />
            ) : (
              <div className="h-full flex items-center justify-center text-primary text-sm">{article.category}</div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-5">
            {readingOrder?.includes(article.slug) && (
              <p className="mb-3 text-[11px] font-bold text-primary">
                {String(readingOrder.indexOf(article.slug) + 1).padStart(2, "0")}
                {readingOrder[0] === article.slug ? " / まず読むべき記事" : " / おすすめの読む順番"}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className={`ui-nowrap text-[11px] font-bold px-3 py-0.5 rounded-full ${getCategoryTheme(article.category).tag}`}>{article.category}</span>
              <time dateTime={article.datePublished} className="text-[11px] text-ink-soft tabular-nums">{article.datePublished}</time>
            </div>
            <h3 className="card-title font-bold group-hover:text-primary transition-colors">{article.title}</h3>
            <p className="mt-4 text-xs leading-[1.8] text-ink-soft line-clamp-2">{article.excerpt}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
