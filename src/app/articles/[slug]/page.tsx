import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArticle, getArticleSlugs, getAllArticleMetas, getCTARegistry } from "@/lib/articles";
import { getCategorySlug, getCategoryTheme } from "@/lib/categories";
import { EditorialSidebar } from "@/components/EditorialSidebar";
import { MobileCareerCTA } from "@/components/MobileCareerCTA";
import { FAQSection } from "@/components/FAQSection";
import { ShareButtons } from "@/components/ShareButtons";
import { TableOfContents } from "@/components/TableOfContents";
import {
  ArticleJsonLd,
  FAQJsonLd,
  BreadcrumbJsonLd,
} from "@/components/JsonLd";
import { DiagnosisBanner } from "@/components/DiagnosisBanner";
import { TemplateDownload } from "@/components/TemplateDownload";
import { MiniAlto } from "@/components/MiniAlto";
import { SurveyLink } from "@/components/SurveyLink";
import { getNoteLinkMap } from "@/lib/note-feed";
import { ArticleBody } from "@/components/ArticleBody";
import { LabeledBox } from "@/components/LabeledBox";
import { ARTICLE_WIDGETS } from "@/lib/article-widgets";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const publishedSlugs = getArticleSlugs();
  if (!publishedSlugs.includes(slug)) return {};
  const article = await getArticle(slug);
  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: `/articles/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      siteName: "NARU",
      locale: "ja_JP",
      url: `/articles/${slug}`,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified || article.datePublished,
      authors: ["磯貝アルト"],
      section: article.category,
      ...(article.cardImagePath && {
        images: [article.cardImagePath],
      }),
    },
  };
}

export default async function ArticlePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  // 存在しない記事・公開日が未来の記事は404
  if (!getArticleSlugs().includes(slug)) notFound();

  const article = await getArticle(slug);
  const allArticles = getAllArticleMetas();
  const relatedArticles = allArticles
    .filter(
      (a) =>
        a.slug !== slug &&
        a.categories.some((c) => article.categories.includes(c))
    )
    .slice(0, 4);

  const theme = getCategoryTheme(article.category);

  // note連携: 対応するnote記事があればリンクを表示
  const noteLinkMap = await getNoteLinkMap();
  const noteLink = noteLinkMap.get(slug);

  // affiliate判定
  const ctaRegistry = getCTARegistry();
  const hasAffiliate = article.cta_agents.some(
    (key) => ctaRegistry[key]?.affiliate !== false
  );
  const hasNonAffiliate = article.cta_agents.some(
    (key) => ctaRegistry[key]?.affiliate === false
  );
  const isMixed = hasAffiliate && hasNonAffiliate;

  const categoryHref = `/category/${getCategorySlug(article.category) ?? "industry-guide"}`;

  const breadcrumbs = [
    { name: "ホーム", href: "/" },
    { name: article.category, href: categoryHref },
    { name: article.title, href: `/articles/${slug}` },
  ];

  return (
    <>
      <ArticleJsonLd article={article} />
      <FAQJsonLd faqs={[
        ...article.faq,
        ...article.inlineFaq.map((ifaq) => ({ question: ifaq.question, answer: ifaq.answer })),
      ]} />
      <BreadcrumbJsonLd items={breadcrumbs} />

      <div className="site-container py-8">
        <nav aria-label="パンくずリスト" className="breadcrumb text-sm text-ink-soft mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            ホーム
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={categoryHref} className="hover:text-primary transition-colors">
            {article.category}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink" aria-current="page" title={article.title}>{article.title}</span>
        </nav>

        <div className="editorial-layout article-detail-layout">
          <article className="article-sheet">
            <span
              className={`ui-nowrap inline-block text-xs font-mono font-medium px-2 py-0.5 rounded ${theme.tag}`}
            >
              {article.category}
            </span>
            <h1 className="editorial-title mt-3 mb-5">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft font-mono">
                <span>
                  公開: <time dateTime={article.datePublished}>{article.datePublished}</time>
                </span>
                {article.dateModified && article.dateModified !== article.datePublished && (
                  <span>
                    更新: <time dateTime={article.dateModified}>{article.dateModified}</time>
                  </span>
                )}
              </div>
              <ShareButtons slug={slug} title={article.title} />
            </div>

            <p className="text-ink-soft leading-relaxed mb-8">
              {article.excerpt}
            </p>

            {(article.heroImagePath || article.cardImagePath) && (
              <div className="mb-8 rounded-sm overflow-hidden">
                {/* hero は1600×600、card（heroが無い記事の代替）は1200×630 */}
                <Image
                  src={article.heroImagePath || article.cardImagePath!}
                  alt={`${article.title}｜${article.category}記事のアイキャッチ画像`}
                  width={article.heroImagePath ? 1600 : 1200}
                  height={article.heroImagePath ? 600 : 630}
                  sizes="(min-width: 1024px) 740px, (min-width: 640px) calc(100vw - 112px), calc(100vw - 40px)"
                  className="w-full h-auto"
                  priority
                />
              </div>
            )}

            {hasAffiliate && (
              <details className="mb-4">
                <summary className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft cursor-pointer hover:text-ink transition-colors">
                  <span className="border border-ink-soft/30 rounded px-1.5 py-0.5 font-mono font-medium">PR</span>
                  プロモーションを含みます
                  <span className="text-[10px]" aria-hidden="true">▼</span>
                </summary>
                <div className="mt-2 bg-bg-soft border border-line rounded-lg px-4 py-3">
                  <p className="text-[12px] text-ink-soft leading-relaxed">
                    {isMixed
                      ? "本記事の一部リンクはプロモーションを含みます。広告を含まないリンクと区別せず掲載していますが、紹介内容・評価はいずれも公平に記載しています。"
                      : "本記事はプロモーションを含みます。当サイトのリンクから商品・サービスにお申し込みいただいた場合、当サイト運営者に成果報酬が支払われることがあります。ただし、これは記事の内容・評価に一切影響を与えません。"}
                    <Link
                      href="/privacy#ads"
                      className="text-primary hover:underline ml-1"
                    >
                      詳しくはプライバシーポリシーをご覧ください
                    </Link>
                  </p>
                </div>
              </details>
            )}


            {article.summary.length > 0 && (
              <LabeledBox label="この記事で分かること" className="mt-6 mb-5">
                <ul>
                  {article.summary.map((point, i) => (
                    <li key={i} className="text-[15px]">
                      {point}
                    </li>
                  ))}
                </ul>
              </LabeledBox>
            )}

            {article.naruPoint && (
              <LabeledBox label="この記事の要点" variant="quiet" className="mt-0 mb-8">
                <p className="text-[14px]">{article.naruPoint}</p>
              </LabeledBox>
            )}

            <TableOfContents headings={article.headings} />

            <ArticleBody
              className="prose"
              style={{ "--category-color": theme.cssColor } as React.CSSProperties}
              contentHtml={article.contentHtml}
              widgets={ARTICLE_WIDGETS[slug] ?? []}
            />

            <MobileCareerCTA />

            {article.resume_template && <TemplateDownload />}

            <FAQSection faqs={article.faq} borderClass={theme.border} />

            {noteLink && (
              <div className="mt-10 p-5 bg-bg-soft border border-line rounded-lg">
                <div>
                  <p className="font-bold text-sm mb-1">この記事のnote版はこちら</p>
                  <a
                    href={noteLink.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {noteLink.noteTitle}
                  </a>
                </div>
              </div>
            )}

            {article.cta_agents.length > 0 && (
              <section className="mt-12 p-6 bg-primary-soft rounded-lg relative">
                <div className="absolute -top-6 right-4 hidden sm:block">
                  <MiniAlto pose="guide" size={56} />
                </div>
                <h2 className="text-lg font-bold mb-3">
                  まずは無料相談から始めてみませんか？
                </h2>
                <p className="text-sm text-ink-soft mb-4">
                  書類添削や面接対策、求人紹介など、自分だけでは進めにくい部分を無料で相談できます。
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/articles/agent-comparison-2026" className="cta-button justify-center">
                    エージェント比較を見る
                  </Link>
                </div>
              </section>
            )}

            <div className="mt-10 pt-6 border-t border-line">
              <ShareButtons slug={slug} title={article.title} />
            </div>

            {relatedArticles.length > 0 && (
              <section className="mt-12">
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-lg font-bold">関連記事</h2>
                  <MiniAlto pose="read" size={40} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedArticles.map((a) => {
                    const relTagStyle = getCategoryTheme(a.category).tag;
                    return (
                      <Link
                        key={a.slug}
                        href={`/articles/${a.slug}`}
                        className="group block bg-surface rounded-lg overflow-hidden border border-line hover:border-primary/30 transition-colors"
                      >
                        <div className="aspect-card relative bg-line">
                          {a.cardImagePath ? (
                            <Image
                              src={a.cardImagePath}
                              alt={`${a.title}｜${a.category}記事のサムネイル画像`}
                              fill
                              className="object-cover"
                              sizes="(min-width: 640px) 340px, 100vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-ink-soft text-xs">{a.category}</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="card-title font-bold text-ink group-hover:text-primary transition-colors">
                            {a.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`ui-nowrap text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${relTagStyle}`}
                            >
                              {a.category}
                            </span>
                            <time dateTime={a.datePublished} className="text-[11px] text-ink-soft">
                              {a.datePublished}
                            </time>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="mt-10 pt-6 border-t border-line">
              <Link
                href="/shindan"
                className="group flex items-center gap-3 text-sm text-ink-soft hover:text-primary transition-colors"
              >
                <MiniAlto pose="idea" size={36} />
                <span>
                  自分がどんな仕事に向いているか、約2分の適職診断で見てみませんか？
                </span>
              </Link>
            </div>

            <div className="mt-4">
              <SurveyLink className="flex items-center gap-3 text-sm text-ink-soft hover:text-primary transition-colors">
                <MiniAlto pose="bow" size={36} />
                <span>
                  第二新卒の転職に関する調査にご協力ください（3分）
                </span>
              </SurveyLink>
            </div>

            {article.updateHistory.length > 0 && (
              <div className="mt-10 pt-6 border-t border-line">
                <p className="font-bold text-sm mb-3 text-ink-soft">更新履歴</p>
                <ul className="text-xs text-ink-soft space-y-1.5">
                  {article.updateHistory.map((entry, i) => (
                    <li key={i} className="flex gap-2">
                      <time dateTime={entry.date} className="shrink-0">{entry.date}</time>
                      <span>{entry.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <EditorialSidebar />
        </div>
      </div>

      <DiagnosisBanner
        href={
          article.category === "エージェント比較" || article.cta_agents.length > 0
            ? "/agent-diagnosis"
            : "/shindan"
        }
        ctaFocus={article.ctaFocus || undefined}
      />
    </>
  );
}
