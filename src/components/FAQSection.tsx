import type { FAQ } from "@/lib/articles";
import { MiniAlto } from "./MiniAlto";

export function FAQSection({
  faqs,
  accentColor = "bg-primary",
}: {
  faqs: FAQ[];
  accentColor?: string;
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
            <h3 className={`font-bold text-ink mb-2 pl-3 border-l-[3px] ${accentColor}`}>
              {faq.question}
            </h3>
            <p className="text-ink-soft leading-relaxed pl-3">{faq.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
