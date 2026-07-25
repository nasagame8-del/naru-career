import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { EmailDisplay } from "./EmailDisplay";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "NARUへのお問い合わせページ。質問・感想、発信者としてのご連絡（相互紹介・寄稿等）を受け付けています。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  // サーバー側で環境変数を読み、クライアントに分割して渡す
  const raw = process.env.CONTACT_EMAIL || "";
  const atIdx = raw.indexOf("@");
  const user = atIdx > 0 ? raw.slice(0, atIdx) : "";
  const domain = atIdx > 0 ? raw.slice(atIdx + 1) : "";

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold mb-2">お問い合わせ</h1>
      <p className="text-sm text-ink-soft mb-8 leading-relaxed">
        NARUに関するご質問・ご感想、発信者としてのご連絡（相互紹介・寄稿のご依頼等）を受け付けています。
      </p>

      <ContactForm />

      <div className="mt-12 pt-8 border-t border-line">
        <h2 className="text-lg font-semibold mb-3">
          直接メールでのご連絡はこちら
        </h2>
        <p className="text-sm text-ink-soft mb-3">
          フォームをお使いにならない場合は、以下のメールアドレスに直接ご連絡いただけます。
        </p>
        <EmailDisplay user={user} domain={domain} />
      </div>
    </div>
  );
}
