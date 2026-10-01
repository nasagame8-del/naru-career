import type { FAQ } from "@/lib/articles";
import { MiniAlto } from "./MiniAlto";

export function FAQSection({
  faqs,
  borderClass = "border-primary",
}: {
  faqs: FAQ[];
  /** 質問見出しの左罫線の色クラス */
  borderClass?: string;
}) {
  if (faqs.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t-2 border-line">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-bold">よくある質問</h2>
        <MiniAlto pose="idea" size={40} />
      </div>
      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i}>
            <h3 className={`font-bold text-ink mb-2 pl-3 border-l-[3px] ${borderClass}`}>
              {faq.question}
            </h3>
            <p className="text-ink-soft leading-relaxed pl-3">{faq.answer.replace(/\*\*/g, "")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
