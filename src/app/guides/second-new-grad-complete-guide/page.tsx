import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "第二新卒×IT/Web転職 完全ガイド | NARU",
  description:
    "第二新卒でIT/Web業界への転職を考えている方へ。基礎知識、転職活動の進め方、エージェント比較、職務経歴書の書き方、面接対策、採用トレンドまで、既存30本以上の記事を1ページにまとめた完全ガイドです。",
  alternates: {
    canonical: "/guides/second-new-grad-complete-guide",
  },
  openGraph: {
    title: "第二新卒×IT/Web転職 完全ガイド",
    description:
      "基礎知識から実体験まで。第二新卒のIT/Web転職に必要な情報を30本以上の記事で網羅した完全ガイド。",
    type: "website",
  },
};

const faqData = [
  {
    question: "第二新卒とは何歳まで？",
    answer:
      "明確な法律上の定義はありませんが、一般的には学校卒業後おおむね3年以内の若手を指します。年齢でいうと25〜26歳程度が目安です。企業によって解釈が異なるため、気になる求人があれば応募条件を直接確認するのが確実です。",
  },
  {
    question: "転職活動はいつから始めるべき？",
    answer:
      "在職中に始めるのが基本です。退職してからだと収入が途絶え、焦って条件を妥協しやすくなります。転職エージェントへの登録・面談は在職中でも可能です。実際の活動期間は2〜3ヶ月が目安ですが、準備（自己分析・書類作成）を含めると3〜4ヶ月見ておくと余裕があります。",
  },
  {
    question: "転職エージェントは何社使うべき？",
    answer:
      "2〜3社がおすすめです。1社だけだと求人の幅が狭くなり、4社以上だとやり取りが煩雑になります。大手総合型（doda等）と特化型を組み合わせると、求人の網羅性とサポートの質を両立しやすいです。",
  },
  {
    question: "プログラミング未経験でもIT業界に転職できる？",
    answer:
      "できます。IT/Web業界にはエンジニア以外の職種（営業、マーケター、カスタマーサクセス、広報など）が多数あります。プログラミングスキルがなくても転職可能な職種は想像以上に幅広いです。",
  },
  {
    question: "転職で年収は上がる？",
    answer:
      "業界や職種によりますが、飲食・小売などの業界からIT/Web業界へ転職した場合、年収が上がるケースは多いです。ただし、未経験転職の場合は一時的に横ばいまたは微減になることもあります。中長期的なキャリアパスで考えることが重要です。",
  },
];

// 記事リンクデータ
const basics = [
  {
    slug: "what-is-second-new-grad",
    title: "第二新卒とは？定義・年齢の目安",
    desc: "「第二新卒」の定義、対象年齢、新卒・中途との違いを整理します。",
  },
];

const worries = [
  {
    slug: "promotion-blocked-by-boss",
    title: "昇進できない理由が「上司の主観」だったら？",
    desc: "評価基準が不明確な環境で何ができるかを考えます。",
  },
  {
    slug: "unfair-evaluation-not-spoiled",
    title: "評価に納得いかないのは甘え？",
    desc: "不満の正体を「感情」と「事実」に切り分けて整理します。",
  },
  {
    slug: "certification-exam-on-hold",
    title: "資格試験を\"保留\"にされた話",
    desc: "受けさせてもらえない理由が実力ではなく上司の都合だった実体験。",
  },
  {
    slug: "job-change-timing-3months",
    title: "転職タイミング、実際に動いた3ヶ月間の記録",
    desc: "いつ動き出し、何をしたかの実体験タイムラインです。",
  },
  {
    slug: "it-industry-quit-myth",
    title: "「IT業界はやめとけ」と言われて転職した話",
    desc: "周囲に反対された状況で、なぜIT業界を選んだのか。",
  },
  {
    slug: "second-new-grad-job-change-traps",
    title: "第二新卒が陥りやすい転職の罠と回避策",
    desc: "実際に失敗した経験から学んだ注意点をまとめます。",
  },
];

const steps = [
  {
    label: "STEP 1：自己分析・書類準備",
    articles: [
      {
        slug: "resume-writing-second-new-grad",
        title: "職務経歴書、第二新卒はここで差がつく",
        desc: "飲食業界の経験をポータブルスキルに翻訳した実例付き。",
      },
    ],
  },
  {
    label: "STEP 2：エージェント選び・応募",
    articles: [
      {
        slug: "agent-comparison-2026",
        title: "doda・ワークポート比較（実体験）",
        desc: "実際に2社使って内定を得た経験からの比較レビュー。",
      },
      {
        slug: "agent-site-vs-agent-usage",
        title: "転職サイトとエージェントの使い分け方",
        desc: "両方使って分かった、それぞれの強み・弱み。",
      },
      {
        slug: "agent-referral-vs-self-apply",
        title: "エージェント紹介 vs 自己応募",
        desc: "どちらが内定に近かったか、実体験から比較。",
      },
      {
        slug: "agent-free-and-cancel",
        title: "エージェントは本当に無料？途中で断れる？",
        desc: "費用の仕組みと途中辞退の実際。",
      },
      {
        slug: "recruitment-agency-business-model",
        title: "人材紹介の仕組みを「中の人」が解説",
        desc: "エージェントのビジネスモデルを知ると使い方が変わる。",
      },
      {
        slug: "bizreach-second-new-grad",
        title: "ビズリーチは第二新卒でも使える？",
        desc: "実際に登録してみた結果と、届いたスカウトの実態。",
      },
    ],
  },
  {
    label: "STEP 3：面接・選考",
    articles: [
      {
        slug: "interview-failure-why-this-job",
        title: "面接で「なぜこの職種を？」と聞かれて詰まった話",
        desc: "志望動機の言語化に失敗した実体験と、そこから学んだこと。",
      },
      {
        slug: "casual-interview",
        title: "カジュアル面談の活用法",
        desc: "本選考前に企業のリアルを知るための面談活用術。",
      },
    ],
  },
  {
    label: "STEP 4：退職・入社準備",
    articles: [
      {
        slug: "how-to-resign-experience",
        title: "退職の伝え方・有給・ボーナスの実体験",
        desc: "誰に、いつ、どう伝えたか。退職手続きのリアル。",
      },
      {
        slug: "second-new-grad-retirement-pay",
        title: "第二新卒に退職金は出ない？",
        desc: "知らないと損する退職金制度の話。",
      },
    ],
  },
];

const trends = [
  { slug: "ai-interview-screening", term: "AI面接・適性検査", desc: "採用側のAI活用と対策法" },
  { slug: "alumni-hiring", term: "アルムナイ採用", desc: "一度辞めた会社に戻れる仕組み" },
  { slug: "casual-interview", term: "カジュアル面談", desc: "本選考前の情報収集の場" },
  { slug: "direct-recruiting", term: "ダイレクトリクルーティング", desc: "スカウト型転職の仕組みと注意点" },
  { slug: "job-type-employment", term: "ジョブ型雇用", desc: "メンバーシップ型との違い" },
  { slug: "referral-hiring", term: "リファラル採用", desc: "社員紹介のメリットと注意点" },
  { slug: "reference-check-explained", term: "リファレンスチェック", desc: "増えている背景と対策" },
  { slug: "ses-explained", term: "SES", desc: "エンジニア派遣型契約の仕組みと見極め方" },
  { slug: "skill-based-hiring", term: "スキルベース採用", desc: "学歴より「何ができるか」の時代" },
  { slug: "what-is-web-industry", term: "Web業界", desc: "職種・働き方・将来性の全体像" },
];

const experiences = [
  {
    slug: "second-new-grad-it-career-change",
    title: "第二新卒がIT業界に転職するための完全ガイド",
    desc: "実体験ベースのIT転職ロードマップ。",
  },
  {
    slug: "second-new-grad-programming-career-change",
    title: "プログラミング未経験でもIT転職できる？",
    desc: "エンジニア以外の選択肢も含めて解説。",
  },
  {
    slug: "it-web-industry-real-work-culture",
    title: "IT/Web業界のリアルな働き方・文化",
    desc: "AIO企業に転職して感じたカルチャーの違い。",
  },
  {
    slug: "web-industry-guide",
    title: "AIO対策の会社で働くってどんな仕事？",
    desc: "未経験入社のリアルな日常。",
  },
  {
    slug: "aio-seo-industry-inside",
    title: "AIO対策企業に営業職で入社した話",
    desc: "そこからマーケティングを独学した経緯。",
  },
];

// CollectionPage + ItemList 構造化データ
function buildStructuredData() {
  const allItems = [
    ...basics.map((a) => ({ name: a.title, url: `https://naru-career.com/articles/${a.slug}` })),
    ...worries.map((a) => ({ name: a.title, url: `https://naru-career.com/articles/${a.slug}` })),
    ...steps.flatMap((s) =>
      s.articles.map((a) => ({ name: a.title, url: `https://naru-career.com/articles/${a.slug}` }))
    ),
    ...trends.map((t) => ({ name: t.term, url: `https://naru-career.com/articles/${t.slug}` })),
    ...experiences.map((a) => ({ name: a.title, url: `https://naru-career.com/articles/${a.slug}` })),
  ];

  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "第二新卒×IT/Web転職 完全ガイド",
    description:
      "第二新卒でIT/Web業界への転職を考えている方へ。基礎知識から実体験まで30本以上の記事を網羅した完全ガイド。",
    url: "https://naru-career.com/guides/second-new-grad-complete-guide",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: allItems.length,
      itemListElement: allItems.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return [collectionPage, faqPage];
}

function ArticleLink({
  slug,
  title,
  desc,
}: {
  slug: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={`/articles/${slug}`}
      className="block border border-line rounded-lg p-4 hover:bg-bg-soft transition-colors"
    >
      <span className="font-bold text-sm text-primary">{title}</span>
      <span className="block text-xs text-ink-soft mt-1">{desc}</span>
    </Link>
  );
}

export default function GuideCompletePage() {
  const structuredData = buildStructuredData();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "第二新卒×IT/Web転職 完全ガイド", href: "/guides/second-new-grad-complete-guide" },
        ]}
      />
      {structuredData.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">
          第二新卒×IT/Web転職 完全ガイド
        </h1>

        {/* ── 結論 ── */}
        <div className="bg-primary-soft rounded-lg p-5 mb-10 text-sm leading-relaxed">
          <p className="mb-2">
            このガイドでは、第二新卒でIT/Web業界への転職を考えている方に必要な情報を、30本以上の記事から1ページにまとめています。
          </p>
          <p className="mb-2">
            「今の会社に不満があるけど、転職すべきか分からない」「IT業界に興味があるけど未経験で不安」「何から始めればいいか分からない」——そんな方は、気になるセクションから読んでみてください。
          </p>
          <p>
            すべての記事は、僕自身が飲食業界からIT/Web業界へ第二新卒で転職した実体験をベースに書いています。
          </p>
        </div>

        {/* ── 第二新卒の基礎知識 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            第二新卒の基礎知識
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            まずは「第二新卒」の定義と、対象年齢の目安を押さえておきましょう。
          </p>
          <div className="space-y-3">
            {basics.map((a) => (
              <ArticleLink key={a.slug} {...a} />
            ))}
          </div>
        </section>

        {/* ── 今の会社で悩んでいる方へ ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            今の会社で悩んでいる方へ
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            「転職」という言葉が頭をよぎる前に、今の悩みを整理してみてください。同じモヤモヤを抱えていた僕の経験が、何かのヒントになるかもしれません。
          </p>
          <div className="space-y-3">
            {worries.map((a) => (
              <ArticleLink key={a.slug} {...a} />
            ))}
          </div>
        </section>

        {/* ── 転職活動の進め方 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            転職活動の進め方
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            転職活動を「自己分析→書類→エージェント選び→面接→退職」の順で整理しました。順番に読んでも、気になるステップだけ読んでもOKです。
          </p>
          {steps.map((step) => (
            <div key={step.label} className="mb-6">
              <h3 className="font-bold text-sm text-ink mb-2">{step.label}</h3>
              <div className="space-y-3">
                {step.articles.map((a) => (
                  <ArticleLink key={a.slug} {...a} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── 採用トレンド用語集 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            知っておきたい採用トレンド用語集
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            転職活動中に出会う採用手法の新しい用語をまとめました。知っているだけで選考の場面で有利になることがあります。
          </p>
          <div className="border border-line rounded-lg divide-y divide-line">
            {trends.map((t) => (
              <Link
                key={t.slug}
                href={`/articles/${t.slug}`}
                className="flex items-baseline gap-3 px-4 py-3 hover:bg-bg-soft transition-colors"
              >
                <span className="font-bold text-sm text-primary whitespace-nowrap">
                  {t.term}
                </span>
                <span className="text-xs text-ink-soft">{t.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 実体験を読む ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            実体験を読む
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            飲食業界からIT/Web業界へ転職した僕のリアルな体験談です。成功も失敗も、できるだけ正直に書いています。
          </p>
          <div className="space-y-3">
            {experiences.map((a) => (
              <ArticleLink key={a.slug} {...a} />
            ))}
          </div>
        </section>

        {/* ── 適職診断 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            あなたに向いている仕事を知る
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            10問の質問に答えるだけで、あなたに合うIT/Web業界の職種タイプが分かります。
          </p>
          <Link
            href="/shindan"
            className="block border-2 border-primary rounded-lg p-5 text-center hover:bg-primary-soft transition-colors"
          >
            <span className="font-bold text-primary">RPG適職診断を受けてみる →</span>
            <span className="block text-xs text-ink-soft mt-1">
              16タイプのRPGキャラクターから、あなたの適職タイプを診断します
            </span>
          </Link>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-primary pb-2">
            よくある質問
          </h2>
          <div className="border border-line rounded-lg divide-y divide-line">
            {faqData.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-[15px] font-bold text-ink hover:text-primary transition-colors list-none [&::-webkit-details-marker]:hidden">
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
        </section>
      </div>
    </>
  );
}
