import Link from "next/link";
import Image from "next/image";
import { getAllArticleMetas } from "@/lib/articles";
import { CategoryTabs } from "@/components/CategoryTabs";

export default function Home() {
  const articles = getAllArticleMetas();
  const featured = articles.slice(0, 3);


  return (
    <>
      {/* 注目記事セクション */}
      <section className="bg-bg-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <span className="inline-block font-mono text-[11px] font-medium tracking-[0.2em] text-accent uppercase mb-6">
            PICKUP
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featured.map((article) => {
              const tagStyle =
                article.category === "体験談"
                  ? "bg-amber-soft text-amber"
                  : article.category === "エージェント比較"
                    ? "bg-accent-soft text-accent"
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
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-ink-soft text-sm">thumbnail</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-ink text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
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
    </>
  );
}
