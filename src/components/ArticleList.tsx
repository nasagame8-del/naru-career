import Link from "next/link";
import Image from "next/image";
import type { ArticleMeta } from "@/lib/articles";

const categoryStyles: Record<string, string> = {
  体験談: "bg-amber-soft text-amber",
  エージェント比較: "bg-accent-soft text-accent",
  業界解説: "bg-gray-soft text-gray",
};

export function ArticleList({ articles }: { articles: ArticleMeta[] }) {
  return (
    <div className="divide-y divide-line">
      {articles.map((article) => {
        const tagStyle =
          categoryStyles[article.category] ?? categoryStyles["業界解説"];
        return (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="flex gap-4 py-5 group transition-colors hover:bg-bg-soft -mx-3 px-3 rounded"
          >
            <div className="w-[120px] sm:w-[200px] aspect-card shrink-0 rounded overflow-hidden relative bg-line">
              {article.hasCardImage ? (
                <Image
                  src={`/images/articles/${article.slug}-card.png`}
                  alt={`${article.title}｜${article.category}記事のサムネイル画像`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 120px, 200px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-ink-soft text-xs">{article.category}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="font-bold text-ink text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                {article.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${tagStyle}`}
                >
                  {article.category}
                </span>
                <time className="text-[11px] text-ink-soft font-mono">
                  {article.datePublished}
                </time>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
