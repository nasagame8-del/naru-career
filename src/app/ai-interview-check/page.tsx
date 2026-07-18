import type { Metadata } from "next";
import { Suspense } from "react";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { AiInterviewCheck } from "@/components/AiInterviewCheck";

export const metadata: Metadata = {
  title: "AI面接チェック",
  description:
    "AI面接で見られているポイントを4つの質問でチェック。カメラ目線・回答構成・沈黙対策・事前練習など、AI面接の評価基準を理解するための無料セルフチェックツールです。",
  alternates: {
    canonical: "/ai-interview-check",
  },
};

export default function AiInterviewCheckPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "AI面接チェック", href: "/ai-interview-check" },
        ]}
      />
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-line rounded-xl p-6 md:p-8">
          <Suspense fallback={<div className="text-center py-12 text-ink-soft text-sm">読み込み中...</div>}>
            <AiInterviewCheck />
          </Suspense>
        </div>

        <div className="mt-10 text-sm text-ink-soft leading-relaxed space-y-3">
          <h2 className="text-base font-bold text-ink">このチェックについて</h2>
          <p>
            AI面接（録画面接）では、回答内容だけでなく、表情・声のトーン・目線・回答構成などをAIが分析しています。このチェックでは、AI面接で評価されるポイントをあなたが把握しているかを4つの質問で確認します。
          </p>
          <p>
            診断スコアではなく「気づき」を提供するためのツールです。各質問の解説を読んで、AI面接への対策にお役立てください。
          </p>
        </div>
      </div>
    </>
  );
}
