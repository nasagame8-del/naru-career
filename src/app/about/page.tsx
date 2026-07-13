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
          著者について
        </h1>
        <div className="prose">
          <p>
            24歳。新卒で入社した会社を1年で退職し、第二新卒としてIT/Web業界にキャリアチェンジしました。
          </p>
          <p>
            現在はAIO（AI Optimization）対策を手がける企業に営業職として勤務しています。本業はさまざまな業界のクライアントに対する法人営業（テレアポ〜商談〜クロージング〜契約〜コンサルティング）です。自社のマーケティングやAIO戦略への関与は、時間外・休日に自主的に取り組んでいる領域で、そこで得た知見と第二新卒としての自分自身の転職体験を合わせて、転職活動の情報を発信しています。
          </p>
          <h2>このメディアについて</h2>
          <p>
            「NARU」は、僕自身の転職活動で感じた「リアルな情報が少ない」という課題から生まれた、第二新卒のIT転職ガイドです。
          </p>
          <p>
            転職エージェントの比較記事や業界解説は、すべて実体験をベースにしています。AIに体験談を捏造させることはせず、実際に経験したことだけを発信しています。
          </p>
          <h2>経歴</h2>
          <ul>
            <li>新卒入社 → 1年で退職</li>
            <li>転職サービス3社を利用</li>
            <li>第二新卒としてIT/Web企業に転職</li>
            <li>現在：AIO対策企業に営業職として勤務</li>
          </ul>
        </div>
      </div>
    </>
  );
}
