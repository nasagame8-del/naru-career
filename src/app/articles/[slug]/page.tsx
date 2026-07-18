import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getArticle, getArticleSlugs, getAllArticleMetas, getCTARegistry } from "@/lib/articles";
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
import { getNoteLinkMap } from "@/lib/note-feed";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
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
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      ...(article.hasCardImage && {
        images: [`/images/articles/${slug}-card.png`],
      }),
    },
  };
}

const categoryAccent: Record<string, { tag: string; border: string; faq: string; cssVar: string }> = {
  体験談: {
    tag: "bg-amber-soft text-amber",
    border: "border-amber",
    faq: "border-amber",
    cssVar: "#B5691B",
  },
  エージェント比較: {
    tag: "bg-accent-soft text-accent",
    border: "border-accent",
    faq: "border-accent",
    cssVar: "#1F6F66",
  },
  業界解説: {
    tag: "bg-bg-soft text-ink-soft",
    border: "border-gray",
    faq: "border-gray",
    cssVar: "#8B8D91",
  },
};

export default async function ArticlePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const article = await getArticle(slug);
  const allArticles = getAllArticleMetas();
  const relatedArticles = allArticles
    .filter((a) => a.slug !== slug && a.category === article.category)
    .slice(0, 4);

  const accent = categoryAccent[article.category] || categoryAccent["業界解説"];

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

  const breadcrumbs = [
    { name: "ホーム", href: "/" },
    { name: article.category, href: `/#articles` },
    { name: article.title, href: `/articles/${slug}` },
  ];

  const categoryTagStyle: Record<string, string> = {
    体験談: "bg-amber-soft text-amber",
    エージェント比較: "bg-accent-soft text-accent",
    業界解説: "bg-gray-soft text-gray",
  };

  return (
    <>
      <ArticleJsonLd article={article} />
      <FAQJsonLd faqs={article.faq} />
      <BreadcrumbJsonLd items={breadcrumbs} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* パンくずリスト */}
        <nav className="text-sm text-ink-soft mb-6 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-accent transition-colors">
            ホーム
          </Link>
          <span>/</span>
          <span>{article.category}</span>
          <span>/</span>
          <span className="text-ink">{article.title}</span>
        </nav>

        <div className="flex gap-10">
          {/* 本文エリア */}
          <article className="flex-1 max-w-[680px]">
            <span
              className={`inline-block text-xs font-mono font-medium px-2 py-0.5 rounded ${accent.tag}`}
            >
              {article.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight mt-3 mb-4">
              {article.title}
            </h1>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 text-sm text-ink-soft font-mono">
                <time>公開: {article.datePublished}</time>
                {article.dateModified !== article.datePublished && (
                  <time>更新: {article.dateModified}</time>
                )}
              </div>
              <ShareButtons slug={slug} title={article.title} />
            </div>

            {/* アイキャッチ画像 */}
            {article.hasHeroImage && (
              <div className="mb-8 rounded-xl overflow-hidden">
                <Image
                  src={`/images/articles/${slug}-hero.png`}
                  alt={`${article.title}｜${article.category}記事のアイキャッチ画像`}
                  width={1600}
                  height={600}
                  className="w-full h-auto"
                  priority
                />
              </div>
            )}

            {/* PR表記（affiliate案件がある記事のみ） */}
            {hasAffiliate && (
              <div className="bg-bg-soft border border-line rounded-lg px-4 py-3 mb-6">
                <p className="text-[12px] text-ink-soft leading-relaxed">
                  {isMixed
                    ? "本記事の一部リンクはプロモーションを含みます。広告を含まないリンクと区別せず掲載していますが、紹介内容・評価はいずれも公平に記載しています。"
                    : "本記事はプロモーションを含みます。当サイトのリンクから商品・サービスにお申し込みいただいた場合、当サイト運営者に成果報酬が支払われることがあります。ただし、これは記事の内容・評価に一切影響を与えません。"}
                  <Link
                    href="/privacy#ads"
                    className="text-accent hover:underline ml-1"
                  >
                    詳しくはプライバシーポリシーをご覧ください
                  </Link>
                </p>
              </div>
            )}

            {/* リード文 */}
            <p className="text-ink-soft leading-relaxed mb-8">
              {article.excerpt}
            </p>

            {/* NARU Point */}
            <div className="relative bg-accent/[0.04] border border-accent/20 rounded-xl px-5 py-5 mb-8 overflow-hidden">
              {/* 右上の折れ紙モチーフ */}
              <div className="absolute top-0 right-0 w-10 h-10">
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-accent/10 border-l-[40px] border-l-transparent" />
                <div className="absolute top-[3px] right-[3px] w-0 h-0 border-t-[12px] border-t-white border-l-[12px] border-l-transparent" />
              </div>
              {/* ラベル */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 bg-accent text-white text-[11px] font-bold tracking-wider px-2.5 py-1 rounded">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" /></svg>
                  NARU Point
                </span>
              </div>
              {/* excerpt を再利用 */}
              <p className="text-[14px] text-ink leading-relaxed font-medium">
                {article.excerpt}
              </p>
            </div>

            {/* この記事で分かること（AIフレンドリーな要約） */}
            {article.summary.length > 0 && (
              <div className={`border-l-[3px] ${accent.border} bg-bg-soft rounded-r-lg px-5 py-4 mb-8`}>
                <p className="font-bold text-sm mb-2">この記事で分かること</p>
                <ul className="space-y-1.5">
                  {article.summary.map((point, i) => (
                    <li key={i} className="text-sm text-ink-soft leading-relaxed flex gap-2">
                      <span className="text-accent shrink-0" aria-hidden="true">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* インライン目次 */}
            <TableOfContents headings={article.headings} />

            {/* 記事本文 */}
            <div
              className="prose"
              style={{ "--category-color": accent.cssVar } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />

            {/* 職務経歴書テンプレートのダウンロード */}
            {article.resume_template && <TemplateDownload />}

            {/* FAQセクション */}
            <FAQSection faqs={article.faq} accentColor={accent.faq} />

            {/* note版リンク */}
            {noteLink && (
              <div className="mt-10 p-5 bg-bg-soft border border-line rounded-lg flex items-start gap-3">
                <span className="text-2xl shrink-0" aria-hidden="true">📝</span>
                <div>
                  <p className="font-bold text-sm mb-1">この記事のnote版はこちら</p>
                  <a
                    href={noteLink.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    {noteLink.noteTitle}
                  </a>
                </div>
              </div>
            )}

            {/* まとめCTA */}
            {article.cta_agents.length > 0 && (
              <section className="mt-12 p-6 bg-accent-soft rounded-lg">
                <h2 className="text-lg font-bold mb-3">
                  まずは無料相談から始めてみませんか？
                </h2>
                <p className="text-sm text-ink-soft mb-4">
                  第二新卒の転職は、プロのサポートを受けることで成功率が大きく上がります。
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="#" className="cta-button justify-center">
                    エージェントに無料相談する
                  </Link>
                </div>
                <p className="text-[10px] text-ink-soft mt-3">
                  ※提携先のサービスです
                </p>
              </section>
            )}

            {/* 記事末尾シェアボタン */}
            <div className="mt-10 pt-6 border-t border-line">
              <ShareButtons slug={slug} title={article.title} />
            </div>

            {/* 関連記事セクション */}
            {relatedArticles.length > 0 && (
              <section className="mt-12">
                <h2 className="text-lg font-bold mb-6">関連記事</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedArticles.map((a) => {
                    const relTagStyle =
                      categoryTagStyle[a.category] ?? categoryTagStyle["業界解説"];
                    return (
                      <Link
                        key={a.slug}
                        href={`/articles/${a.slug}`}
                        className="group block bg-white rounded-lg overflow-hidden border border-line hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-card relative bg-line">
                          {a.hasCardImage ? (
                            <Image
                              src={`/images/articles/${a.slug}-card.png`}
                              alt={`${a.title}｜${a.category}記事のサムネイル画像`}
                              fill
                              className="object-cover"
                              sizes="300px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-ink-soft text-xs">thumb</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-sm text-ink leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                            {a.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${relTagStyle}`}
                            >
                              {a.category}
                            </span>
                            <time className="text-[10px] text-ink-soft font-mono">
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
          </article>

          {/* サイドバー */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-8 space-y-8">
              {/* 著者情報 */}
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
                    <span className="block text-[9px] text-ink-soft text-center mt-0.5">※アバター</span>
                  </div>
                  <p className="font-semibold text-sm">磯貝アルト</p>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">
                  24歳・転職1回。AIO対策企業に営業職として勤務。業務外で自社のマーケティング・AIO戦略にも取り組む。エージェントの裏側を知る立場から転職情報を発信。
                </p>
                <Link
                  href="/about"
                  className="text-sm text-accent hover:underline mt-2 inline-block"
                >
                  プロフィールを見る →
                </Link>
              </div>

              {/* サイドバー目次 */}
              {article.headings.length > 0 && (
                <div className="border border-line rounded-lg p-5">
                  <p className="font-bold text-sm mb-3">目次</p>
                  <ol className="space-y-1.5">
                    {article.headings.map((h, i) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="text-xs text-ink-soft hover:text-accent transition-colors leading-relaxed flex gap-1.5"
                        >
                          <span className="font-mono text-ink-soft/60 shrink-0">
                            {i + 1}.
                          </span>
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* スクロール連動型の診断バナー */}
      <DiagnosisBanner
        href={
          article.category === "エージェント比較" || article.cta_agents.length > 0
            ? "/agent-diagnosis"
            : "/diagnosis"
        }
      />
    </>
  );
}
