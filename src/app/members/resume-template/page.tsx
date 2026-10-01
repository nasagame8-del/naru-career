import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "職務経歴書テンプレート ダウンロード",
  robots: { index: false, follow: false },
};

export default function ResumeTemplatePage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-xl font-bold text-ink mb-6">
          職務経歴書テンプレート ダウンロード
        </h1>

        <div className="bg-white border border-line rounded-lg p-6 space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            note有料記事をご購入いただきありがとうございます。
          </p>
          <p className="text-sm text-ink leading-relaxed">
            このページでは、僕が実際に使った職務経歴書をベースにしたテンプレート（Word形式）を配布します。飲食業界からIT/Web業界への転職を想定した構成になっていますが、他業界からの転職にも応用できます。
          </p>

          {/* 配布ファイル（/members/files/resume-template-naru.docx）が未配置のため、
              ファイルを置くまでリンクを出さない */}
          <div className="pt-4 border-t border-line" role="status">
            <p className="inline-flex items-center px-6 py-3 bg-bg-soft text-ink-soft text-sm font-bold rounded-lg">
              現在ダウンロードできません（準備中）
            </p>
            <p className="text-xs text-ink-soft leading-relaxed mt-3">
              テンプレートファイルを準備しています。お急ぎの場合は
              <Link href="/contact" className="text-primary underline underline-offset-2 mx-0.5">
                お問い合わせ
              </Link>
              からご連絡ください。
            </p>
          </div>

          <p className="text-xs text-ink-soft leading-relaxed pt-2">
            ※ このページのURLとパスワードは有料記事の購入者限定です。第三者への共有はご遠慮ください。
          </p>
        </div>

        <p className="text-xs text-ink-soft mt-8 text-center">
          <Link href="/" className="hover:text-primary transition-colors">
            ← NARUトップへ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
