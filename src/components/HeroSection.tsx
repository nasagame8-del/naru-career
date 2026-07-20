import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="bg-bg border-b border-line overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="flex flex-col md:flex-row md:items-center md:gap-12">
          {/* 左カラム: コピー */}
          <div className="flex-1 mb-8 md:mb-0">
            <h1 className="font-serif text-[26px] md:text-[32px] font-bold text-ink leading-[1.4] tracking-tight mb-4">
              第二新卒の僕が、<br className="hidden md:inline" />
              30社応募して見つけた<br />
              「自分らしい働き方」
            </h1>
            <p className="text-sm md:text-[15px] text-ink-soft leading-relaxed mb-6 max-w-md">
              新卒で入社した飲食企業を1年で退職。そこから第二新卒でIT/Web業界へ転職した僕のリアルな体験と、役立つ情報を発信しています。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#articles"
                className="inline-flex items-center px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
              >
                最新記事を読む
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center px-6 py-2.5 bg-surface text-primary text-sm font-bold rounded-lg border border-primary hover:bg-primary-soft transition-colors"
              >
                プロフィールを見る
              </Link>
            </div>
          </div>

          {/* 右カラム: 写真カード風イラスト */}
          <div className="relative flex-shrink-0 md:w-[380px]">
            {/* メインカード */}
            <div className="bg-surface border border-line rounded-lg p-2 rotate-[1.5deg] shadow-sm">
              <Image
                src="/images/hero-alto-desk.webp"
                alt="デスクでノートパソコンに向かう著者・磯貝アルトのイラスト"
                width={720}
                height={480}
                priority
                className="rounded w-full h-auto"
              />
            </div>

            {/* 手書き風メモ（HTMLテキスト） */}
            <div className="absolute -bottom-4 -left-3 md:-left-6 bg-surface border border-line rounded px-3 py-2 -rotate-[2deg] shadow-sm max-w-[200px]">
              <p className="text-[13px] text-ink-soft italic leading-snug">
                失敗も、迷いも、<br />ぜんぶ書きます。
              </p>
            </div>

            {/* AI生成開示 */}
            <p className="text-[10px] text-ink-soft mt-6 text-center md:text-right -rotate-0">
              ※このイラストはAIで生成したイラストです。実在の人物ではありません。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
