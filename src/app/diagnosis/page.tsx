import type { Metadata } from "next";
import { Suspense } from "react";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { DiagnosisTool } from "@/components/DiagnosisTool";

export const metadata: Metadata = {
  title: "適職診断 | 第二新卒向け",
  description:
    "10問の質問に答えるだけで、あなたに向いているIT/Web業界の職種タイプと、合いそうな社風の傾向が分かります。第二新卒・未経験からのキャリアチェンジに役立つ無料診断ツールです。",
  alternates: {
    canonical: "/diagnosis",
  },
};

export default function DiagnosisPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "適職診断", href: "/diagnosis" },
        ]}
      />
      <div className="max-w-xl mx-auto px-4 py-16">
        {/* SSGでレンダリングされるイントロ（AIクローラー向け） */}
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-semibold mb-4">
            適職診断
          </h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            10問の質問に答えるだけで、あなたに向いているIT/Web業界の職種タイプと、
            合いそうな社風の傾向が分かります。
          </p>
          <p className="text-xs text-ink-soft mt-2">
            所要時間: 約2分 ・ 完全無料
          </p>
        </div>

        {/* クライアントコンポーネント（インタラクティブな診断部分） */}
        <div className="bg-white border border-line rounded-xl p-6 md:p-8">
          <Suspense fallback={
            <div className="text-center py-12 text-ink-soft text-sm">
              診断を読み込んでいます...
            </div>
          }>
            <DiagnosisTool />
          </Suspense>
        </div>

        {/* SSGの補足テキスト（SEO/AEO用） */}
        <div className="mt-12 text-sm text-ink-soft leading-relaxed space-y-4">
          <h2 className="text-base font-bold text-ink">この診断について</h2>
          <p>
            この適職診断は、第二新卒・未経験からIT/Web業界へのキャリアチェンジを
            検討している方を対象にしたものです。6問の職種適性テストと4問の社風傾向テストで、
            5つの職種タイプ（エンジニア系・Webマーケター系・カスタマーサクセス系・
            営業系・ディレクター/PM系）のうち、最も適性の高いタイプを判定します。
          </p>
          <p>
            診断結果では、タイプ別の解説、おすすめの記事、おすすめの転職エージェントを
            ご紹介します。結果はURLで共有でき、Xでのシェアも可能です。
          </p>
          <h2 className="text-base font-bold text-ink">5つの職種タイプ</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>エンジニア系（モノづくり型）— 開発・プログラミングに興味がある方</li>
            <li>Webマーケター・AIO系（分析・発信型）— データ分析・施策立案が好きな方</li>
            <li>カスタマーサクセス系（伴走・関係構築型）— 顧客との関係構築が得意な方</li>
            <li>営業系（対人・数字型）— コミュニケーションと成果達成にやりがいを感じる方</li>
            <li>ディレクター・PM系（調整・進行型）— 全体を俯瞰してチームを回すのが得意な方</li>
          </ul>
        </div>
      </div>
    </>
  );
}
