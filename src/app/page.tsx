import Link from "next/link";
import Image from "next/image";
import { getAllArticleMetas } from "@/lib/articles";
import { CategoryTabs } from "@/components/CategoryTabs";
import { LatestNotePosts } from "@/components/LatestNotePosts";
import { HeroSection } from "@/components/HeroSection";

export default function Home() {
  const articles = getAllArticleMetas();
  const featured = articles.slice(0, 3);


  return (
    <>
      {/* ヒーローセクション */}
      <HeroSection />

      {/* 注目記事セクション */}
      <section className="bg-bg-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <span className="inline-block font-mono text-[11px] font-medium tracking-[0.2em] text-primary uppercase mb-6">
            PICKUP
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featured.map((article, index) => {
              const tagStyle =
                article.category === "体験談"
                  ? "bg-amber-soft text-amber"
                  : article.category === "エージェント比較"
                    ? "bg-primary-soft text-primary"
                    : "bg-gray-soft text-gray";
              return (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group block bg-white rounded-lg overflow-hidden border border-line hover:shadow-lg transition-all duration-150 hover:-translate-y-0.5"
                >
                  <div className="aspect-card relative bg-line overflow-hidden">
                    {article.hasCardImage ? (
                      <Image
                        src={`/images/articles/${article.slug}-card.png`}
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
                        className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${tagStyle}`}
                      >
                        {article.category}
                      </span>
                      <time className="text-[10px] text-ink-soft font-mono">
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

      {/* 記事一覧セクション */}
      <section id="articles" className="max-w-5xl mx-auto px-4 pt-12 pb-16">
        <h2 className="text-xl font-bold mb-6">記事一覧</h2>
        <CategoryTabs articles={articles} />
      </section>

      {/* 著者実績帯（フッター手前） */}
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
            <span className="font-mono text-xl font-medium text-ink">3</span>
            <span className="text-[11px] text-ink-soft mt-0.5">社のサービス利用</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="text-sm font-medium text-ink">AIO対策</span>
            <span className="text-[11px] text-ink-soft mt-0.5">企業に勤務</span>
          </div>
        </div>
      </section>

      {/* 適職診断への導線 */}
      <section className="border-t border-line">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <a
            href="/shindan"
            className="group flex items-center gap-4 bg-white border border-line rounded-lg p-5 hover:shadow-lg transition-all duration-150 hover:-translate-y-0.5"
          >
            <Image
              src="/images/mini/alto-mini-idea.png"
              alt=""
              width={48}
              height={48}
              className="flex-shrink-0"
            />
            <div>
              <p className="font-bold text-sm text-ink group-hover:text-primary transition-colors">
                自分がどんな仕事に向いているか、3分の適職診断で見てみませんか？
              </p>
              <p className="text-xs text-ink-soft mt-1">
                10の質問に答えるだけ。RPGキャラクターで16タイプの適職を診断します
              </p>
            </div>
            <span className="ml-auto text-primary text-sm font-medium flex-shrink-0">
              診断する →
            </span>
          </a>
        </div>
      </section>

      {/* 最新のnote投稿 */}
      <LatestNotePosts />
    </>
  );
}
