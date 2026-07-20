import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";

const categoryStyles: Record<string, string> = {
  体験談: "bg-amber-soft text-amber",
  エージェント比較: "bg-primary-soft text-primary",
  業界解説: "bg-gray-soft text-gray",
};

const barColors: Record<string, string> = {
  体験談: "bg-amber",
  エージェント比較: "bg-primary",
  業界解説: "bg-gray",
};

export function ArticleCard({ article }: { article: ArticleMeta }) {
  const tagStyle = categoryStyles[article.category] ?? categoryStyles["業界解説"];
  const barColor = barColors[article.category] ?? barColors["業界解説"];

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="block bg-white border border-line rounded-lg overflow-hidden transition-all duration-150 hover:border-ink-soft hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className={`h-[3px] ${barColor}`} />
      <div className="p-5">
        <span
          className={`inline-block text-xs font-mono font-medium px-2 py-0.5 rounded ${tagStyle}`}
        >
          {article.category}
        </span>
        <h3 className="font-bold text-ink mt-2 mb-2 leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-ink-soft line-clamp-2">{article.excerpt}</p>
        <time className="block text-xs text-ink-soft font-mono mt-3">
          {article.datePublished}
        </time>
      </div>
    </Link>
  );
}
