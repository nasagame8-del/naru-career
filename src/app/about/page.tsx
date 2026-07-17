import type { Metadata } from "next";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "著者について",
  description:
    "24歳・転職1回。AIO対策企業に営業職として勤務しながら、第二新卒のIT/Web転職体験を発信する著者のプロフィール。",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <PersonJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "著者について", href: "/about" },
        ]}
      />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-2xl md:text-3xl font-semibold mb-8">
          著者について — アルト
        </h1>
        <div className="prose">
          <p>
            アルトです。24歳。新卒で入社した会社を1年で退職し、第二新卒としてIT/Web業界にキャリアチェンジしました。
          </p>
          <p>
            現在はAIO（AI Optimization）対策を手がける企業に営業職として勤務しています。人材紹介・人材派遣会社を主要クライアントとする、SEO/AIO領域の法人営業を担当しています。テレアポから商談、契約後のコンサルティングまでを一気通貫で行っており、業務の傍らでSEO/AIOの実務知識を独学しています。
          </p>
          <p>
            そこで得た知見と第二新卒としての自分自身の転職体験を合わせて、転職活動の情報を発信しています。
          </p>

          {/* 転職活動の実績 */}
          <h2>転職活動の実績</h2>
        </div>

        <div className="border border-line rounded-lg bg-bg-soft my-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-line">
            <div className="flex flex-col items-center px-4 py-5">
              <span className="font-mono text-xl font-medium text-ink">約3ヶ月</span>
              <span className="text-[11px] text-ink-soft mt-1">転職活動期間</span>
              <span className="text-[10px] text-ink-soft">2025年8月〜</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5">
              <span className="font-mono text-xl font-medium text-ink">約30社</span>
              <span className="text-[11px] text-ink-soft mt-1">応募社数</span>
              <span className="text-[10px] text-ink-soft">エージェント+自己応募</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5">
              <span className="font-mono text-xl font-medium text-ink">2社</span>
              <span className="text-[11px] text-ink-soft mt-1">内定獲得</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5">
              <span className="font-mono text-xl font-medium text-accent">350→400万</span>
              <span className="text-[11px] text-ink-soft mt-1">年収の変化</span>
              <span className="text-[10px] text-ink-soft">飲食業界 → IT/Web業界</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5 col-span-2 sm:col-span-2">
              <span className="text-sm font-medium text-ink">doda・ワークポート</span>
              <span className="text-[11px] text-ink-soft mt-1">利用した転職サービス</span>
              <span className="text-[10px] text-ink-soft">ワークポートはビズリーチ経由で接点</span>
            </div>
          </div>
        </div>

        <div className="prose">
          <h2>このメディアについて</h2>
          <p>
            「NARU」は、僕自身の転職活動で感じた「リアルな情報が少ない」という課題から生まれた、第二新卒のIT転職ガイドです。
          </p>
          <p>
            転職エージェントの比較記事や業界解説は、すべて実体験をベースにしています。AIに体験談を捏造させることはせず、実際に経験したことだけを発信しています。
          </p>
          <h2>経歴</h2>
          <ul>
            <li>新卒入社（飲食業界） → 1年で退職</li>
            <li>doda・ワークポートを利用して転職活動</li>
            <li>第二新卒としてIT/Web企業に転職（doda経由で内定・入社）</li>
            <li>現在：AIO対策企業にて法人営業を担当</li>
          </ul>

          <h2>編集ポリシー</h2>
          <p>
            本サイトの記事は、Claude Codeを用いて下書きを作成し、執筆者本人が事実確認・編集を行っています。公式情報・実体験・第三者からの情報は、記事内で区別して記載するよう努めています。
          </p>
        </div>
      </div>
    </>
  );
}
