import type { Metadata } from "next";
import Image from "next/image";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "磯貝アルト（著者）について",
  description:
    "「NARU」運営者・磯貝アルトのプロフィール。第二新卒で飲食業界からIT/Web業界へ転職。現在はAIO対策企業でSEO・AIO領域の法人営業に携わっています。",
  alternates: {
    canonical: "/about",
  },
};

const aboutFaqs = [
  {
    question: "本当に転職を経験していますか？",
    answer:
      "はい。私は新卒で入社した飲食業界の会社を約1年で退職し、第二新卒としてIT/Web業界に転職しました。転職活動ではdodaとワークポートを利用し、最終的にdoda経由の自己応募で現在の会社に内定・入社しています。",
  },
  {
    question: "現在も転職業界に関わる仕事をしていますか？",
    answer:
      "はい。現在はAIO対策企業で法人営業として勤務しており、主なクライアントは人材紹介会社・人材派遣会社です。SEO・AIO領域の提案営業を通じて、転職業界の採用動向や集客手法に日常的に接しています。",
  },
  {
    question: "AIだけで記事を書いていますか？",
    answer:
      "いいえ。記事の下書きにはClaude Codeを活用していますが、実体験・事実確認・編集はすべて私自身が行っています。AIに体験談を捏造させることはなく、実際に経験したことだけを発信しています。",
  },
];

export default function AboutPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: aboutFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <PersonJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "著者について", href: "/about" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* ヘッダー */}
        <div className="flex items-start gap-6 mb-8">
          <div className="shrink-0">
            <Image
              src="/images/author-avatar.webp"
              alt="磯貝アルトのイラストアバター"
              width={96}
              height={96}
              className="rounded-full"
            />
            <span className="block text-[10px] text-ink-soft text-center mt-1">
              ※イラストです
            </span>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">
              著者について — 磯貝アルト
            </h1>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">
              第二新卒で飲食業界からIT/Web業界へ転職。現在はAIO対策企業でSEO・AIO領域に携わっています。
            </p>
          </div>
        </div>

        <div className="prose">
          <p>こんにちは、磯貝アルトです。</p>
          <p>
            「NARU」は、私が個人で運営している第二新卒向けの転職メディアです。
          </p>
          <p>
            私は24歳で新卒入社した飲食業界の会社を約1年で退職し、第二新卒としてIT/Web業界へ転職しました。
          </p>
          <p>
            現在は、AIO（AI
            Optimization）対策を手がける企業で法人営業として勤務しています。人材紹介会社・人材派遣会社や不動産業界など、さまざまな業界のクライアントに対し、SEO・AIO領域の提案から商談、契約後のコンサルティングまで一貫して担当しています。
          </p>
          <p>
            転職活動を経験した当事者としての視点と、現在の検索マーケティング・AI領域での実務経験を活かし、「第二新卒が納得して転職できる情報」を発信しています。
          </p>

          {/* プロフィール */}
          <h2>プロフィール</h2>
        </div>

        <div className="border border-line rounded-lg bg-bg-soft my-4 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["名前", "磯貝アルト"],
                ["運営サイト", "NARU"],
                [
                  "専門分野",
                  "第二新卒転職、IT/Web転職、転職エージェント、SEO、AIO",
                ],
                ["現在の職種", "AIO対策企業 法人営業"],
                [
                  "担当領域",
                  "SEO・AIO提案営業、コンサルティング",
                ],
                ["主なクライアント", "人材紹介会社・人材派遣会社、不動産業界 など"],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-line last:border-b-0">
                  <th className="text-left px-4 py-3 bg-bg-soft font-medium text-ink-soft w-[140px] align-top">
                    {label}
                  </th>
                  <td className="px-4 py-3">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prose">
          {/* 転職活動の実績 */}
          <h2>転職活動の実績</h2>
        </div>

        {/* 実績セクション — 背景画像 + HTMLテキスト */}
        <section
          className="relative my-6 rounded-xl overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: "url('/images/about-stats-bg.png')" }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
            <div className="text-center mb-10">
              <span className="text-sm font-medium text-amber-soft tracking-widest uppercase">
                年収の変化
              </span>
              <div className="font-sans text-4xl md:text-5xl font-bold text-white mt-2 tracking-tight">
                350万 → 400万
              </div>
              <span className="inline-block mt-2 text-sm text-white/80">
                飲食業界 → IT/Web業界
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1.4fr] gap-5 md:gap-6">
              <div className="bg-white/90 rounded-lg px-4 py-5 text-center shadow-sm border border-white/60">
                <span className="block font-sans text-xl md:text-2xl font-bold text-ink whitespace-nowrap">
                  約3ヶ月
                </span>
                <span className="block text-xs text-ink-soft mt-1">
                  活動期間
                </span>
              </div>
              <div className="bg-white/90 rounded-lg px-4 py-5 text-center shadow-sm border border-white/60">
                <span className="block font-sans text-xl md:text-2xl font-bold text-ink whitespace-nowrap">
                  約30社
                </span>
                <span className="block text-xs text-ink-soft mt-1">
                  応募企業
                </span>
              </div>
              <div className="bg-white/90 rounded-lg px-4 py-5 text-center shadow-sm border border-white/60">
                <span className="block font-sans text-xl md:text-2xl font-bold text-ink whitespace-nowrap">
                  2社
                </span>
                <span className="block text-xs text-ink-soft mt-1">
                  内定獲得
                </span>
              </div>
              <div className="bg-white/90 rounded-lg px-4 py-5 text-center shadow-sm border border-white/60">
                <span className="block font-sans text-sm md:text-base font-bold text-ink">
                  doda・
                  <br />
                  ワークポート
                </span>
                <span className="block text-xs text-ink-soft mt-1">
                  利用サービス
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="prose">
          <p>
            転職活動ではうまくいったことだけでなく、思うように進まなかったことや失敗した経験もあります。そのため、このサイトでは成功談だけではなく、実際に感じたことや悩んだことも含めて発信しています。
          </p>

          {/* NARUを立ち上げた理由 */}
          <h2>NARUを立ち上げた理由</h2>
          <p>
            転職活動中、「第二新卒向けの情報」を探しても、広告目的のランキング記事や、実体験に基づかない一般論ばかりが目につきました。
          </p>
          <p>
            実際に転職活動を経験してみると、エージェントの対応や面接の手応えは、一般的な記事に書かれている内容とかなりギャップがありました。「自分のリアルな体験をベースに、第二新卒の役に立つ情報を発信できないか」と考えたのが、NARUを立ち上げたきっかけです。
          </p>

          {/* このサイトで発信していること */}
          <h2>このサイトで発信していること</h2>
          <ul>
            <li>転職エージェントの比較・実体験レビュー</li>
            <li>IT/Web業界の職種・働き方の解説</li>
            <li>第二新卒の転職で役立つノウハウ（職務経歴書、面接対策など）</li>
            <li>転職活動の失敗談・後悔したこと</li>
            <li>AIO/SEO業界のリアルな働き方</li>
            <li>新しい採用手法の解説（スキルベース採用、AI面接など）</li>
          </ul>

          {/* 記事制作について */}
          <h2>記事制作について</h2>
          <p>
            NARUの記事は、以下のステップで制作しています。
          </p>
          <ol>
            <li>
              <strong>キーワード調査・構成設計</strong>
              ：読者の検索意図を分析し、記事の骨子を設計します
            </li>
            <li>
              <strong>下書き作成（AI活用）</strong>
              ：Claude
              Codeを活用して下書きを生成します。実体験が必要な箇所はプレースホルダーとして残します
            </li>
            <li>
              <strong>実体験の挿入・事実確認</strong>
              ：私自身の経験をもとに、下書きの体験談パートを執筆・修正します
            </li>
            <li>
              <strong>ファクトチェック</strong>
              ：数値・サービス情報・法的な記述に誤りがないか確認します
            </li>
            <li>
              <strong>公開・更新</strong>
              ：公開後も定期的に情報を見直し、古くなった内容は更新しています
            </li>
          </ol>

          {/* 編集ポリシー */}
          <h2>編集ポリシー</h2>
          <ul>
            <li>
              記事の下書きにはAI（Claude Code）を活用していますが、実体験・事実確認・編集はすべて執筆者本人が行っています
            </li>
            <li>
              AIに体験談を捏造させることはありません。実際に経験したことだけを発信しています
            </li>
            <li>
              公式情報・実体験・第三者からの情報は、記事内で区別して記載するよう努めています
            </li>
            <li>
              アフィリエイト広告を含む記事には、その旨を明記しています
            </li>
            <li>
              掲載情報に誤りがあった場合は、速やかに訂正します
            </li>
          </ul>

          {/* よくある質問 */}
          <h2>よくある質問</h2>
        </div>

        <div className="my-4 border border-line rounded-lg divide-y divide-line">
          {aboutFaqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-[15px] font-bold text-ink hover:text-accent transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span className="text-ink-soft text-xs shrink-0 ml-4 transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm text-ink-soft leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
