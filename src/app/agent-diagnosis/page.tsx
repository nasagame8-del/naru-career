import type { Metadata } from "next";
import { Suspense } from "react";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { DiagnosisApp } from "@/components/AgentDiagnosis";

export const metadata: Metadata = {
  title: "エージェント相性診断",
  description:
    "5つの質問に答えるだけで、あなたに合った転職・就活エージェントが分かります。新卒・第二新卒それぞれに最適なサービスを診断。完全無料・登録不要。",
  alternates: {
    canonical: "/agent-diagnosis",
  },
};

export default function AgentDiagnosisPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "エージェント相性診断", href: "/agent-diagnosis" },
        ]}
      />

      {/* クライアントコンポーネント */}
      <Suspense
        fallback={
          <div className="max-w-[440px] mx-auto px-4 py-16 text-center text-ink-soft text-sm">
            診断を読み込んでいます...
          </div>
        }
      >
        <DiagnosisApp />
      </Suspense>

      {/* SSG補足テキスト（AIクローラー向け） */}
      <div className="max-w-[440px] mx-auto px-4 sm:px-6 pb-12">
        <div className="text-sm text-ink-soft leading-relaxed space-y-3">
          <h2 className="text-base font-bold text-ink">この診断について</h2>
          <p>
            このエージェント相性診断は、新卒（就活中）と第二新卒（転職検討中）の両方に対応した無料診断ツールです。5つの質問に回答するだけで、あなたの転職・就職活動スタイルに合ったエージェントを7つの候補から診断します。
          </p>
          <p>
            新卒ルートではマイナビ新卒紹介・dodaキャンパス・OfferBox・キャリアチケット・就職エージェントneoの5つ、第二新卒ルートではdoda・第二新卒エージェントneoの2つが候補となります。
          </p>
          <p>
            診断結果はURLで共有でき、Xでのシェアも可能です。個人情報の入力は一切不要です。
          </p>
        </div>
      </div>
    </>
  );
}
