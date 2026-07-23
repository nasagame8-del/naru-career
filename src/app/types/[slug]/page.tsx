import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID, ALL_SLUGS } from "../../shindan/_lib/data";
import { getHubArticles } from "../type-hub-data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) return {};
  const t = TYPES16[id];
  return {
    title: `${t.name}の特徴・向いている仕事・おすすめ記事 | RPG適職診断`,
    description: `${t.desc} 向いている環境や第二新卒×IT/Webの狙い目、おすすめ記事をまとめています。`,
  };
}

export default async function TypeHubPage({ params }: Props) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) notFound();

  const t = TYPES16[id];
  const color = TYPE_COLORS[id] || "#b06a1c";
  const articles = getHubArticles(id);
  const bgExists = true; // all 16 backgrounds exist

  const faq = [
    {
      q: `${t.name.split("（")[0]}タイプはどんな仕事に向いていますか？`,
      a: `${t.strength}が向いています。${t.goodEnv}`,
    },
    {
      q: `${t.name.split("（")[0]}タイプが避けた方がいい環境は？`,
      a: t.badEnv,
    },
    {
      q: `第二新卒で${t.name.split("（")[0]}タイプにおすすめの職種は？`,
      a: t.careerTip,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${t.name}の特徴・向いている仕事`,
    description: t.desc,
    url: `https://naru-career.com/types/${slug}`,
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── ヒーロー ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "340px" }}
      >
        {/* 背景画像 */}
        {bgExists && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/images/shindan/share-bg/${slug}.png`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* オーバーレイ */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${color}dd 0%, ${color}99 100%)` }}
        />
        {/* コンテンツ */}
        <div className="relative max-w-3xl mx-auto px-4 py-16 text-center text-white">
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/shindan/types/type${id}.png`}
              alt={t.name}
              width={140}
              height={140}
              className="rounded-xl"
              style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.3)` }}
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
            {t.name}
          </h1>
          <p className="text-lg opacity-90 max-w-xl mx-auto leading-relaxed">
            {t.desc}
          </p>
          <div className="mt-6">
            <Link
              href="/shindan"
              className="inline-block px-6 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors backdrop-blur"
            >
              診断を受けてみる →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 本文 ── */}
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">

        {/* 向いている環境 */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full" style={{ background: "#3f9e57" }} />
            向いている環境
          </h2>
          <p className="text-ink-soft leading-relaxed">{t.goodEnv}</p>
        </section>

        {/* 消耗しやすい環境 */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full" style={{ background: "#d65a5a" }} />
            消耗しやすい環境
          </h2>
          <p className="text-ink-soft leading-relaxed">{t.badEnv}</p>
        </section>

        {/* 第二新卒×IT/Webの狙い目 */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full" style={{ background: "#e0842f" }} />
            第二新卒×IT/Webの狙い目
          </h2>
          <p className="text-ink-soft leading-relaxed">{t.careerTip}</p>
        </section>

        {/* おすすめ記事 */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full" style={{ background: color }} />
            {t.name.split("（")[0]}タイプにおすすめの記事
          </h2>
          <div className="grid gap-3">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="group flex items-center gap-3 p-4 bg-white border border-line rounded-lg hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <span
                  className="w-1 h-8 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-sm font-medium text-ink group-hover:text-primary transition-colors">
                  {a.title}
                </span>
                <span className="ml-auto text-xs text-ink-soft shrink-0">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold mb-4">よくある質問</h2>
          <div className="space-y-4">
            {faq.map((f, i) => (
              <details key={i} className="group border border-line rounded-lg">
                <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-medium text-ink">
                  <span>{f.q}</span>
                  <span className="text-ink-soft group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-ink-soft leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* 他のタイプを見る */}
        <section className="pt-8 border-t border-line">
          <h2 className="text-lg font-bold mb-4 text-center">他のタイプを見る</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(TYPES16).map(([tid, tt]) => (
              <Link
                key={tid}
                href={`/types/${tt.slug}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  tt.slug === slug
                    ? "border-primary bg-primary text-white"
                    : "border-line text-ink-soft hover:border-primary hover:text-primary"
                }`}
              >
                {tt.name.split("（")[0]}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
