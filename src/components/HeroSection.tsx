import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="bg-bg border-b border-line overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:flex-row md:items-start md:gap-6">
          {/* 左カラム */}
          <div className="flex-1 min-w-0 mb-4 md:mb-0 md:pt-2">
            {/* 1段目: 手書きコピー — モバイル中央/PC左揃え */}
            <div className="-rotate-[1.5deg] mb-1 flex justify-center md:justify-start">
              <Image
                src="/images/hero-note-tegaki.png"
                alt="失敗も、迷いも、ぜんぶ書きます。"
                width={500}
                height={200}
                className="w-[240px] md:w-[320px] h-auto"
              />
            </div>

            {/* 2段目: キャッチコピー — モバイル中央/PC左揃え */}
            <h1 className="font-serif text-lg md:text-[21px] font-bold text-ink leading-[1.55] mb-2 text-center md:text-left whitespace-nowrap">
              <span className="inline-block">第二新卒の僕が、</span><br />
              <span className="inline-block">30社応募して見つけた</span><br />
              <span className="inline-block">「自分らしい働き方」</span>
            </h1>

            {/* 3段目: 説明文 — モバイル左揃え中央配置/PC左揃え */}
            <p className="text-[13px] md:text-sm text-ink-soft leading-relaxed mb-3 md:mb-5 max-w-[320px] md:max-w-lg mx-auto md:mx-0">
              新卒で入社した飲食企業を1年で退職。そこから第二新卒でIT/Web業界へ転職した僕のリアルな体験と、役立つ情報を発信しています。
            </p>

            {/* モバイル: イラスト（余白均等化） */}
            <div className="md:hidden mb-3">
              <Image
                src="/images/hero-alto-desk-transparent.webp"
                alt="デスクでノートパソコンに向かう著者・磯貝アルトのイラスト"
                width={720}
                height={480}
                priority
                className="w-full h-auto"
              />
            </div>

            {/* ボタン — モバイル中央/PC左揃え */}
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
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

          {/* 右カラム（デスクトップのみ） */}
          <div className="hidden md:flex flex-shrink-0 w-[560px] -mr-12 items-end self-end">
            <Image
              src="/images/hero-alto-desk-transparent.webp"
              alt="デスクでノートパソコンに向かう著者・磯貝アルトのイラスト"
              width={1120}
              height={747}
              priority
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
