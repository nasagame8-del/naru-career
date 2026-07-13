import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "用語集",
  description:
    "第二新卒の転職活動で知っておきたい用語を、転職・採用用語、IT/Web業界用語、AIO/SEO用語のカテゴリ別に解説。各用語の定義を結論から簡潔にまとめています。",
  alternates: {
    canonical: "/glossary",
  },
};

type GlossaryTerm = {
  term: string;
  definition: string;
  relatedArticle?: { slug: string; title: string };
};

type GlossaryCategory = {
  title: string;
  terms: GlossaryTerm[];
};

const glossaryData: GlossaryCategory[] = [
  {
    title: "転職・採用用語",
    terms: [
      {
        term: "第二新卒とは",
        definition:
          "一般的に、新卒で入社した会社を3年以内に退職し、転職活動をする20代前半〜半ばの人を指します。厳密な法的定義はなく、企業によって対象年齢の線引きは異なりますが、多くの場合22〜26歳程度が目安です。新卒と違い社会人経験がある一方、中途採用ほどの即戦力は求められない「ポテンシャル採用」の対象になりやすいのが特徴です。",
        relatedArticle: {
          slug: "what-is-second-new-grad",
          title: "第二新卒とは？定義・年齢目安",
        },
      },
      {
        term: "既卒とは",
        definition:
          "学校卒業後、就職せずに一定期間（1〜3年程度）が経過した人を指します。第二新卒との違いは「就業経験の有無」です。第二新卒は一度就職して退職した人、既卒は卒業後に一度も正社員として働いていない人を指します。",
      },
      {
        term: "ポテンシャル採用とは",
        definition:
          "現時点でのスキルや実績よりも、今後の伸びしろ・将来性を重視して採用する方式です。第二新卒はこの対象になりやすく、未経験の職種・業界へのキャリアチェンジがしやすい理由の一つです。",
      },
      {
        term: "リファラル採用とは",
        definition:
          "社員による知人・友人の紹介を通じた採用方法です。企業側は採用コストを抑えられ、紹介された側もある程度社風を知った上で応募できるメリットがあります。",
      },
      {
        term: "ジョブ型雇用とは",
        definition:
          "職務内容（ジョブ）を明確に定義し、その職務に必要なスキルを持つ人を採用する雇用形態です。欧米企業に多く、日本でも徐々に導入が進んでいます。配属先や仕事内容が入社前から明確なのが特徴です。",
      },
      {
        term: "メンバーシップ型雇用とは",
        definition:
          "職務を限定せず、会社の一員として採用し、配属や異動は入社後に会社が決める雇用形態です。日本の伝統的な新卒一括採用はこの形式が主流でした。ジョブ型雇用と対比して語られることが多い用語です。",
      },
      {
        term: "キャリアアドバイザーとは",
        definition:
          "転職エージェントで、求職者（転職希望者）側を担当する専任スタッフです。面談を通じてキャリアの棚卸しや希望条件のヒアリングを行い、求人紹介から面接対策、条件交渉までをサポートします。",
        relatedArticle: {
          slug: "agent-comparison-2026",
          title: "第二新卒の転職で使ったエージェント比較",
        },
      },
      {
        term: "RA（リクルーティングアドバイザー）とは",
        definition:
          "転職エージェントで、企業（採用したい側）を担当する専任スタッフです。キャリアアドバイザーが求職者側の窓口であるのに対し、RAは企業側の窓口として、求人票の作成や採用要件のすり合わせを行います。",
      },
      {
        term: "非公開求人とは",
        definition:
          "一般には公開されておらず、転職エージェント経由でのみ紹介される求人のことです。企業が競合に採用計画を知られたくない場合や、応募が殺到するのを避けたい場合に非公開求人として扱われることがあります。",
      },
      {
        term: "スカウト型サービスとは",
        definition:
          "自分のプロフィール・経歴を登録しておくと、興味を持った企業やエージェントから直接連絡が来る仕組みのサービスです。ビズリーチなどが代表例です。自分から応募するのではなく、声がかかるのを待つ形の転職活動になります。",
        relatedArticle: {
          slug: "bizreach-second-new-grad",
          title: "ビズリーチは第二新卒でも使える？",
        },
      },
      {
        term: "RPO（採用代行）とは",
        definition:
          "Recruitment Process Outsourcingの略で、企業の採用業務（母集団形成、書類選考、面接調整など）の一部または全部を外部に委託する仕組みです。人材紹介・人材派遣会社がこのサービスを提供しているケースも多く、採用市場を理解する上で押さえておきたい用語です。",
      },
    ],
  },
  {
    title: "IT/Web業界用語",
    terms: [
      {
        term: "SESとは",
        definition:
          "System Engineering Serviceの略で、エンジニアが自社ではなくクライアント企業に常駐して働く契約形態です。「客先常駐」とも呼ばれます。多重下請け構造になりやすい会社もあり、これが「SESはやめとけ」と言われる一因になっています。",
        relatedArticle: {
          slug: "web-industry-guide",
          title: "未経験からWeb業界を目指す人のための業界ガイド",
        },
      },
      {
        term: "SIerとは",
        definition:
          "System Integratorの略で、クライアント企業のシステム開発・構築を一括して請け負う企業のことです。大手SIerの下に、SES企業が多重下請けの形で入ることも多く、業界構造を理解する上で押さえておきたい用語です。",
        relatedArticle: {
          slug: "web-industry-guide",
          title: "未経験からWeb業界を目指す人のための業界ガイド",
        },
      },
      {
        term: "自社開発とは",
        definition:
          "自社で企画したサービス・プロダクトを、自社のエンジニアが開発する形態です。クライアントワークではなく自社サービスに集中できるため、エンジニア志望者から人気の高い働き方です。",
      },
      {
        term: "受託開発とは",
        definition:
          "クライアント企業から依頼を受けて、システムやアプリを開発する形態です。案件ごとに開発内容が変わるため、幅広い技術に触れられる一方、自社サービスのような裁量権は持ちにくい傾向があります。",
      },
      {
        term: "カスタマーサクセスとは",
        definition:
          "自社の商品・サービスを導入した顧客が、継続的に成果を出せるよう伴走支援する職種です。「売って終わり」の営業と異なり、契約後の顧客との関係構築・活用支援が主な業務になります。IT/Web業界、特にSaaS企業で需要が高い職種です。",
      },
    ],
  },
];

// FAQPage JSON-LD用に全用語をフラット化
const allTerms = glossaryData.flatMap((cat) => cat.terms);

function GlossaryFaqJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allTerms.map((t) => ({
      "@type": "Question",
      name: t.term,
      acceptedAnswer: {
        "@type": "Answer",
        text: t.definition,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function Accordion({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-line">
      <summary className="flex items-center justify-between cursor-pointer py-4 text-ink font-bold text-[15px] hover:text-accent transition-colors list-none [&::-webkit-details-marker]:hidden">
        <span>{term}</span>
        <span className="text-ink-soft text-xs shrink-0 ml-4 transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="pb-5 text-sm text-ink-soft leading-relaxed">
        {children}
      </div>
    </details>
  );
}

export default function GlossaryPage() {
  return (
    <>
      <GlossaryFaqJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "用語集", href: "/glossary" },
        ]}
      />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-2xl md:text-3xl font-semibold mb-4">用語集</h1>
        <p className="text-sm text-ink-soft mb-10">
          第二新卒の転職活動で出てくる用語を、カテゴリ別にまとめました。各用語をクリックすると定義が開きます。
        </p>

        {glossaryData.map((category) => (
          <section key={category.title} className="mb-12">
            <h2 className="text-lg font-bold mb-4 pl-3 border-l-[3px] border-accent">
              {category.title}
            </h2>
            <div>
              {category.terms.map((t) => (
                <Accordion key={t.term} term={t.term}>
                  <p>{t.definition}</p>
                  {t.relatedArticle && (
                    <Link
                      href={`/articles/${t.relatedArticle.slug}`}
                      className="inline-block mt-3 text-accent hover:underline text-xs"
                    >
                      関連記事: {t.relatedArticle.title} →
                    </Link>
                  )}
                </Accordion>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
