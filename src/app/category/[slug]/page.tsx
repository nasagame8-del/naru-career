import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticleMetas } from "@/lib/articles";
import { CATEGORIES, isValidCategorySlug } from "@/lib/categories";
import { ArticleList } from "@/components/ArticleList";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

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
    title: `${cat.label}の記事一覧`,
    description: cat.description,
    alternates: {
      canonical: `/category/${slug}`,
    },
  };
}

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  if (!isValidCategorySlug(slug)) notFound();

  const cat = CATEGORIES[slug];
  const articles = getAllArticleMetas().filter(
    (a) => a.category === cat.name
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: cat.label, href: `/category/${slug}` },
        ]}
      />
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-16">
        <nav className="text-sm text-ink-soft mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-accent transition-colors">
            ホーム
          </Link>
          <span>/</span>
          <span className="text-ink">{cat.label}</span>
        </nav>

        <h1 className="text-2xl font-bold mb-2">{cat.label}</h1>
        <p className="text-sm text-ink-soft mb-8">{cat.description}</p>

        {/* カテゴリナビ */}
        <div className="flex border-b border-line mb-6">
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

        {articles.length > 0 ? (
          <ArticleList articles={articles} />
        ) : (
          <p className="text-ink-soft py-10 text-center">
            このカテゴリの記事はまだありません。
          </p>
        )}
      </div>
    </>
  );
}
