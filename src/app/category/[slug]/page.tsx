import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleHasCategory, getAllArticleMetas, type ArticleMeta } from "@/lib/articles";
import { CATEGORIES, isValidCategorySlug } from "@/lib/categories";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { getAuthorProfileLabel } from "@/lib/author";
import { ArticleList } from "@/components/ArticleList";
import { EditorialSidebar } from "@/components/EditorialSidebar";
import { MobileCareerCTA } from "@/components/MobileCareerCTA";
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
      description: cat.description.replace("{authorProfile}", getAuthorProfileLabel()),
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
  const allArticles = getAllArticleMetas().filter((a) =>
    articleHasCategory(a, cat.name)
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

      <div className="site-container pt-8 pb-16">
        <nav aria-label="パンくずリスト" className="breadcrumb text-sm text-ink-soft mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            ホーム
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink" aria-current="page">{cat.label}</span>
        </nav>

        <section className="mb-12">
          <h1 className="editorial-title mb-4">
            {cat.label}
          </h1>
          <p className="text-ink-soft leading-relaxed text-[15px] max-w-3xl">
            {cat.longDescription}
          </p>
        </section>

        <div className="editorial-layout">
        <div className="min-w-0">
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

            <ArticleList articles={articles.slice(0, 6)} readingOrder={cat.readingOrder} priority />
            <MobileCareerCTA />
            {articles.length > 6 && <div className="mt-6"><ArticleList articles={articles.slice(6)} readingOrder={cat.readingOrder} /></div>}
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
        <EditorialSidebar />
        </div>
      </div>
    </>
  );
}
