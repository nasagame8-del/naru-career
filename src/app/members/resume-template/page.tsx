import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "職務経歴書テンプレート ダウンロード | NARU",
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
            以下から、僕が実際に使った職務経歴書をベースにしたテンプレート（Word形式）をダウンロードできます。飲食業界からIT/Web業界への転職を想定した構成になっていますが、他業界からの転職にも応用できます。
          </p>

          <div className="pt-4 border-t border-line">
            <a
              href="/members/files/resume-template-naru.docx"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              職務経歴書テンプレート_NARU配布用.docx
            </a>
          </div>

          <p className="text-xs text-ink-soft leading-relaxed pt-2">
            ※ このページのURLとパスワードは有料記事の購入者限定です。第三者への共有はご遠慮ください。
          </p>
        </div>

        <p className="text-xs text-ink-soft mt-8 text-center">
          <a href="/" className="hover:text-primary transition-colors">
            ← NARUトップへ戻る
          </a>
        </p>
      </div>
    </div>
  );
}
