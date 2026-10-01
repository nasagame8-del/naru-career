import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllArticleMetas, type ArticleMeta } from "@/lib/articles";
import { CATEGORIES, getCategoryTheme, isValidCategorySlug } from "@/lib/categories";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { MiniAlto } from "@/components/MiniAlto";

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
    openGraph: {
      title: `${cat.label}｜第二新卒の転職ガイド`,
      description: cat.description,
      type: "website",
      siteName: "NARU",
      locale: "ja_JP",
      url: `/category/${slug}`,
      images: ["/logo-wordmark.png"],
    },
  };
}

/** 記事をreadingOrder順に並べ、未登録の記事は末尾に追加 */
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

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  if (!isValidCategorySlug(slug)) notFound();

  const cat = CATEGORIES[slug];
  const allArticles = getAllArticleMetas().filter(
    (a) => a.categories.includes(cat.name)
  );
  const articles = sortByReadingOrder(allArticles, cat.readingOrder);
  const hasReadingOrder = cat.readingOrder.length > 0;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: cat.label, href: `/category/${slug}` },
        ]}
      />

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
        <nav aria-label="パンくずリスト" className="text-sm text-ink-soft mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary transition-colors">
            ホーム
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink" aria-current="page">{cat.label}</span>
        </nav>

        <section className="mb-12">
          <h1 className="font-serif text-2xl md:text-3xl font-bold mb-4 leading-snug">
            {cat.label}
          </h1>
          <p className="text-ink-soft leading-relaxed text-[15px] max-w-3xl">
            {cat.longDescription}
          </p>
        </section>

        {articles.length > 0 ? (
          <section className="mb-16">
            {hasReadingOrder ? (
              <>
                <h2 className="text-lg font-bold mb-1">おすすめの読む順番</h2>
                <p className="text-sm text-ink-soft mb-6">
                  上から順に読むと、テーマ全体を体系的に理解できます。
                </p>
              </>
            ) : (
              <h2 className="text-lg font-bold mb-6">記事一覧</h2>
            )}

            <ol className="space-y-4">
              {articles.map((article, i) => {
                const isInOrder = i < cat.readingOrder.length;
                return (
                  <li key={article.slug}>
                    <Link
                      href={`/articles/${article.slug}`}
                      className="flex items-start gap-4 p-4 rounded-lg border border-line hover:border-primary/30 hover:bg-bg-soft transition-colors group"
                    >
                      <span
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isInOrder ? cat.theme.badge : "bg-surface border border-line text-ink-soft"
                        }`}
                      >
                        {i + 1}
                      </span>

                      <div className="shrink-0 w-[100px] md:w-[160px] aspect-card rounded overflow-hidden bg-bg-soft">
                        {article.cardImagePath ? (
                          <Image
                            src={article.cardImagePath}
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

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <span
                            className={`shrink-0 whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full ${getCategoryTheme(article.category).tag}`}
                          >
                            {article.category}
                          </span>
                          {isInOrder && i === 0 && (
                            <span className="text-[11px] font-medium text-primary">
                              まず読むべき記事
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-ink leading-snug group-hover:text-primary transition-colors line-clamp-2 text-[15px]">
                          {article.title}
                        </h3>
                        <p className="text-sm text-ink-soft mt-1 line-clamp-2 hidden md:block">
                          {article.excerpt}
                        </p>
                        <time dateTime={article.datePublished} className="text-xs text-ink-soft font-mono mt-1.5 block">
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
          <div className="py-10 text-center">
            <MiniAlto pose="think" size={120} className="mx-auto mb-4" />
            <p className="text-ink-soft">このカテゴリの記事はまだありません。</p>
          </div>
        )}

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
                  className="block p-5 rounded-lg border border-line hover:border-primary/30 hover:bg-bg-soft transition-colors group"
                >
                  <span className="text-base font-bold text-ink group-hover:text-primary transition-colors">
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
