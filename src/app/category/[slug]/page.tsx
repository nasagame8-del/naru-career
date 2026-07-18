import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllArticleMetas, type ArticleMeta } from "@/lib/articles";
import { CATEGORIES, isValidCategorySlug } from "@/lib/categories";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/JsonLd";
import { FAQSection } from "@/components/FAQSection";

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  if (!isValidCategorySlug(slug)) return {};
  const cat = CATEGORIES[slug];
  return {
    title: `${cat.label}｜第二新卒の転職ガイド`,
    description: cat.longDescription.slice(0, 160),
    alternates: {
      canonical: `/category/${slug}`,
    },
  };
}

/* ── 記事をreadingOrder順に並べ、未登録の記事は末尾に追加 ── */
function sortByReadingOrder(
  articles: ArticleMeta[],
  readingOrder: string[]
): ArticleMeta[] {
  const orderMap = new Map(readingOrder.map((slug, i) => [slug, i]));
  return [...articles].sort((a, b) => {
    const ia = orderMap.get(a.slug) ?? 9999;
    const ib = orderMap.get(b.slug) ?? 9999;
    return ia - ib;
  });
}

/* ── カテゴリごとのスタイルマップ ── */
const categoryStyles: Record<string, string> = {
  体験談: "bg-amber-soft text-amber",
  エージェント比較: "bg-accent-soft text-accent",
  業界解説: "bg-gray-soft text-gray",
};

const stepBadgeStyles: Record<string, string> = {
  体験談: "bg-amber text-white",
  エージェント比較: "bg-accent text-white",
  業界解説: "bg-gray text-white",
};

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  if (!isValidCategorySlug(slug)) notFound();

  const cat = CATEGORIES[slug];
  const allArticles = getAllArticleMetas().filter(
    (a) => a.category === cat.name
  );
  const articles = sortByReadingOrder(allArticles, cat.readingOrder);
  const badgeStyle = stepBadgeStyles[cat.name] ?? "bg-accent text-white";
  const tagStyle = categoryStyles[cat.name] ?? "bg-accent-soft text-accent";

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: cat.label, href: `/category/${slug}` },
        ]}
      />
      <FAQJsonLd faqs={cat.faq} />

      <div className="max-w-5xl mx-auto px-4 pt-12 pb-16">
        {/* パンくず */}
        <nav className="text-sm text-ink-soft mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-accent transition-colors">
            ホーム
          </Link>
          <span>/</span>
          <span className="text-ink">{cat.label}</span>
        </nav>

        {/* カテゴリナビ */}
        <div className="flex border-b border-line mb-8">
          {Object.entries(CATEGORIES).map(([s, c]) => (
            <Link
              key={s}
              href={`/category/${s}`}
              className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
                s === slug
                  ? "text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* ── ヒーローセクション ── */}
        <section className="mb-12">
          <h1 className="font-serif text-2xl md:text-3xl font-bold mb-4 leading-snug">
            {cat.label}
          </h1>
          <p className="text-ink-soft leading-relaxed text-[15px] max-w-3xl">
            {cat.longDescription}
          </p>
        </section>

        {/* ── 読む順番つき記事一覧 ── */}
        {articles.length > 0 ? (
          <section className="mb-16">
            <h2 className="text-lg font-bold mb-1">
              おすすめの読む順番
            </h2>
            <p className="text-sm text-ink-soft mb-6">
              上から順に読むと、テーマ全体を体系的に理解できます。
            </p>

            <ol className="space-y-4">
              {articles.map((article, i) => {
                const isInOrder = i < cat.readingOrder.length;
                return (
                  <li key={article.slug}>
                    <Link
                      href={`/articles/${article.slug}`}
                      className="flex items-start gap-4 p-4 rounded-lg border border-line hover:border-accent/30 hover:bg-bg-soft transition-all group"
                    >
                      {/* ステップバッジ */}
                      <span
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isInOrder ? badgeStyle : "bg-line text-ink-soft"
                        }`}
                      >
                        {i + 1}
                      </span>

                      {/* サムネイル */}
                      <div className="shrink-0 w-[100px] md:w-[160px] aspect-card rounded overflow-hidden bg-bg-soft">
                        {article.hasCardImage ? (
                          <Image
                            src={`/images/articles/${article.slug}-card.png`}
                            alt={`${article.title}｜${article.category}記事のサムネイル画像`}
                            width={320}
                            height={168}
                            className="w-full h-full object-cover"
                            sizes="(max-width:768px) 100px, 160px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-soft text-xs">
                            {article.category}
                          </div>
                        )}
                      </div>

                      {/* テキスト */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tagStyle}`}
                          >
                            {article.category}
                          </span>
                          {isInOrder && i === 0 && (
                            <span className="text-[11px] font-medium text-accent">
                              まず読むべき記事
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-ink leading-snug group-hover:text-accent transition-colors line-clamp-2 text-[15px]">
                          {article.title}
                        </h3>
                        <p className="text-sm text-ink-soft mt-1 line-clamp-2 hidden md:block">
                          {article.excerpt}
                        </p>
                        <time className="text-xs text-ink-soft font-mono mt-1.5 block">
                          {article.datePublished}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          <p className="text-ink-soft py-10 text-center">
            このカテゴリの記事はまだありません。
          </p>
        )}

        {/* ── FAQセクション ── */}
        {cat.faq.length > 0 && (
          <FAQSection faqs={cat.faq} accentColor={cat.accentColor} />
        )}

        {/* ── 他カテゴリへの誘導 ── */}
        {cat.crossLinks.length > 0 && (
          <section className="mt-14 pt-8 border-t-2 border-line">
            <h2 className="text-lg font-bold mb-5">
              あわせて読みたいカテゴリ
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {cat.crossLinks.map((link) => (
                <Link
                  key={link.slug}
                  href={`/category/${link.slug}`}
                  className="block p-5 rounded-lg border border-line hover:border-accent/30 hover:bg-bg-soft transition-all group"
                >
                  <span className="text-base font-bold text-ink group-hover:text-accent transition-colors">
                    {link.label} →
                  </span>
                  <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
                    {link.message}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
