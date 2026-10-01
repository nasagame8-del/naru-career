const DOCX_HREF = encodeURI("/downloads/職務経歴書テンプレート_NARU.docx");
const PDF_HREF = encodeURI("/downloads/職務経歴書テンプレート_NARU.pdf");

// クリック計測（template_download）は CtaTracker が data-track-* を見て行う
export function TemplateDownload() {
  return (
    <section className="mt-12 border border-primary rounded-lg bg-primary-soft p-6">
      <h2 className="text-lg font-bold mb-2">
        職務経歴書テンプレートを無料配布しています
      </h2>
      <p className="text-sm text-ink-soft mb-5 leading-relaxed">
        この記事で紹介した構成をそのまま使えるテンプレートを無料で配布しています。
        メールアドレスの登録は不要です。下のボタンをクリックすると、すぐにダウンロードできます。
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={DOCX_HREF}
          download="職務経歴書テンプレート_NARU.docx"
          data-track-event="template_download"
          data-track-format="word"
          className="cta-button justify-center"
        >
          Word版をダウンロード
        </a>
        <a
          href={PDF_HREF}
          download="職務経歴書テンプレート_NARU.pdf"
          data-track-event="template_download"
          data-track-format="pdf"
          className="cta-button justify-center"
          style={{ background: "var(--ink)" }}
        >
          PDF版をダウンロード
        </a>
      </div>
      <p className="text-[11px] text-ink-soft mt-3">
        ※ Word版は編集用、PDF版は印刷・確認用としてご利用ください。
      </p>
    </section>
  );
}
