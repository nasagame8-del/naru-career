import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArticle, getArticleSlugs, getAllArticleMetas, getCTARegistry } from "@/lib/articles";
import { getCategorySlug, getCategoryTheme } from "@/lib/categories";
import { getAuthorProfileLabel } from "@/lib/author";
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

      <div className="max-w-5xl mx-auto px-4 py-8">
        <nav aria-label="パンくずリスト" className="text-sm text-ink-soft mb-6 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">
            ホーム
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={categoryHref} className="hover:text-primary transition-colors">
            {article.category}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink" aria-current="page">{article.title}</span>
        </nav>

        <div className="flex gap-10 min-w-0">
          <article className="flex-1 min-w-0 max-w-[700px]">
            <span
              className={`inline-block text-xs font-mono font-medium px-2 py-0.5 rounded ${theme.tag}`}
            >
              {article.category}
            </span>
            <h1 className="text-2xl md:text-[32px] font-semibold leading-tight mt-3 mb-5">
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

            {(article.heroImagePath || article.cardImagePath) && (
              <div className="mb-8 rounded-lg overflow-hidden">
                {/* hero は1600×600、card（heroが無い記事の代替）は1200×630 */}
                <Image
                  src={article.heroImagePath || article.cardImagePath!}
                  alt={`${article.title}｜${article.category}記事のアイキャッチ画像`}
                  width={article.heroImagePath ? 1600 : 1200}
                  height={article.heroImagePath ? 600 : 630}
                  sizes="(min-width: 768px) 700px, 100vw"
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

            <p className="text-ink-soft leading-relaxed mb-8">
              {article.excerpt}
            </p>

            {article.naruPoint && (
              <div className="bg-primary-soft/50 border border-primary/20 rounded-lg px-5 py-5 mb-8">
                <span className="inline-block bg-primary text-white text-[11px] font-bold tracking-wider px-2.5 py-1 rounded mb-2.5">
                  NARU Point
                </span>
                <p className="text-[14px] text-ink leading-relaxed font-medium">
                  {article.naruPoint}
                </p>
              </div>
            )}

            {article.summary.length > 0 && (
              <div className={`border-l-[3px] ${theme.border} bg-bg-soft rounded-r-lg px-5 py-4 mb-8`}>
                <p className="font-bold text-sm mb-2">この記事で分かること</p>
                <ul className="space-y-1.5">
                  {article.summary.map((point, i) => (
                    <li key={i} className="text-sm text-ink-soft leading-relaxed flex gap-2">
                      <span className="text-primary shrink-0" aria-hidden="true">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TableOfContents headings={article.headings} />

            <ArticleBody
              className="prose"
              style={{ "--category-color": theme.cssColor } as React.CSSProperties}
              contentHtml={article.contentHtml}
              widgets={ARTICLE_WIDGETS[slug] ?? []}
            />

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
                          <h3 className="font-bold text-sm text-ink leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {a.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${relTagStyle}`}
                            >
                              {a.category}
                            </span>
                            <time dateTime={a.datePublished} className="text-[11px] text-ink-soft font-mono">
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
                      <time dateTime={entry.date} className="font-mono shrink-0">{entry.date}</time>
                      <span>{entry.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-8 space-y-8">
              <div className="border border-line rounded-lg p-5">
                <p className="font-bold text-sm mb-3">この記事を書いた人</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="shrink-0">
                    <Image
                      src="/images/author-avatar.webp"
                      alt="磯貝アルトのイラストアバター"
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <span className="block text-[10px] text-ink-soft text-center mt-0.5">※アバター</span>
                  </div>
                  <p className="font-semibold text-sm">磯貝アルト</p>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">
                  {getAuthorProfileLabel()}。AIO対策企業に営業職として勤務。業務外で自社のマーケティング・AIO戦略にも取り組む。エージェントの裏側を知る立場から転職情報を発信。
                </p>
                <div className="flex items-center justify-between mt-2">
                  <Link
                    href="/about"
                    className="text-sm text-primary hover:underline"
                  >
                    プロフィールを見る →
                  </Link>
                  <MiniAlto pose="bow" size={48} />
                </div>
              </div>

              {article.headings.length > 0 && (
                <nav aria-label="目次" className="border border-line rounded-lg p-5">
                  <p className="font-bold text-sm mb-3">目次</p>
                  <ol className="space-y-1.5">
                    {article.headings.map((h, i) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="text-xs text-ink-soft hover:text-primary transition-colors leading-relaxed flex gap-1.5"
                        >
                          <span className="font-mono text-ink-soft shrink-0">
                            {i + 1}.
                          </span>
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
            </div>
          </aside>
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
