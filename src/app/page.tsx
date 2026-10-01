import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllArticleMetas } from "@/lib/articles";
import { CategoryTabs } from "@/components/CategoryTabs";
import { LatestNotePosts } from "@/components/LatestNotePosts";
import { HeroSection } from "@/components/HeroSection";
import { getCategoryTheme } from "@/lib/categories";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const articles = getAllArticleMetas();
  const featured = articles.slice(0, 3);

  return (
    <>
      <HeroSection />

      <section className="bg-bg-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="font-mono text-[11px] font-medium tracking-widest text-primary uppercase mb-6">
            PICKUP
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featured.map((article) => {
              const tagStyle = getCategoryTheme(article.category).tag;
              return (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group block bg-surface rounded-lg overflow-hidden border border-line hover:border-primary/30 transition-colors"
                >
                  <div className="aspect-card relative bg-line overflow-hidden">
                    {article.cardImagePath ? (
                      <Image
                        src={article.cardImagePath}
                        alt={`${article.title}｜${article.category}記事のサムネイル画像`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-ink-soft text-sm">{article.category}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-ink text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${tagStyle}`}
                      >
                        {article.category}
                      </span>
                      <time dateTime={article.datePublished} className="text-[11px] text-ink-soft font-mono">
                        {article.datePublished}
                      </time>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Link
            href="/shindan"
            className="group block bg-primary rounded-lg p-6 text-center hover:bg-primary/90 transition-colors"
          >
            <p className="text-white/80 text-xs mb-1">
              どの記事から読めばいいか迷った方へ
            </p>
            <p className="text-white font-bold text-base md:text-lg">
              まずは約2分の適職診断で、あなたに合う記事を見つけませんか？
            </p>
            <span className="inline-block mt-3 text-white text-sm font-medium border border-white/40 rounded-lg px-5 py-2 group-hover:bg-white/10 transition-colors">
              RPG適職診断を始める →
            </span>
          </Link>
        </div>
      </section>

      <section id="articles" className="max-w-5xl mx-auto px-4 pt-12 pb-16">
        <h2 className="text-xl font-bold mb-6">記事一覧</h2>
        <CategoryTabs articles={articles} />
      </section>

      <section className="border-t border-line bg-bg-soft">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-wrap items-center justify-center">
          <div className="flex flex-col items-center px-6 py-1">
            <span className="font-mono text-xl font-medium text-ink">24</span>
            <span className="text-[11px] text-ink-soft mt-0.5">歳で転職</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="font-mono text-xl font-medium text-ink">1</span>
            <span className="text-[11px] text-ink-soft mt-0.5">回の転職経験</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="font-mono text-xl font-medium text-ink">2</span>
            <span className="text-[11px] text-ink-soft mt-0.5">社のサービス利用</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="text-sm font-medium text-ink">AIO対策</span>
            <span className="text-[11px] text-ink-soft mt-0.5">企業に勤務</span>
          </div>
        </div>
      </section>

      <LatestNotePosts />
    </>
  );
}
