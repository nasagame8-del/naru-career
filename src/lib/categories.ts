import type { FAQ } from "@/lib/articles";

type CategoryCrossLink = {
  slug: string;
  label: string;
  message: string;
};

type CategoryDef = {
  name: "体験談" | "エージェント比較" | "業界解説";
  label: string;
  description: string;
  longDescription: string;
  accentColor: string;
  readingOrder: string[];
  faq: FAQ[];
  crossLinks: CategoryCrossLink[];
};

export const CATEGORIES: Record<string, CategoryDef> = {
  taiken: {
    name: "体験談",
    label: "体験談",
    description:
      "24歳・転職1回の実体験をベースにした、第二新卒のIT/Web転職の体験談記事一覧。転職を決意した理由から内定獲得までのリアルな記録を掲載。",
    longDescription:
      "このカテゴリでは、24歳・第二新卒として飲食業界からIT/Web業界へ転職した筆者の実体験をすべて公開しています。「転職しようかな」と思い始めた段階から、エージェント登録・書類作成・面接対策・退職交渉・入社後のリアルまで、時系列に沿って追体験できる構成です。体験談だからこそ書ける「実際どうだったか」を軸に、第二新卒が転職活動で直面する場面をひとつずつカバーしています。同じ境遇の方が「次に何をすればいいか」を判断できるよう、読む順番も整理しました。",
    accentColor: "bg-amber",
    readingOrder: [
      "second-new-grad-it-career-change",
      "web-industry-guide",
      "second-new-grad-programming-career-change",
      "job-change-timing-3months",
      "resume-writing-second-new-grad",
      "interview-failure-why-this-job",
      "agent-referral-vs-self-apply",
      "bizreach-second-new-grad",
      "how-to-resign-experience",
      "it-industry-quit-myth",
    ],
    faq: [
      {
        question: "体験談の記事はどんな順番で読めばいいですか？",
        answer:
          "まず「第二新卒がIT業界に転職するための完全ガイド」で全体像を把握し、その後は転職活動の時系列（準備→書類→面接→退職）に沿って読むと理解しやすいです。ページ上部に推奨順を表示しています。",
      },
      {
        question: "体験談の内容はすべて実体験ですか？",
        answer:
          "はい。筆者が24歳・第二新卒として飲食業界からIT/Web業界（AIO対策企業）へ転職した実体験がベースです。エージェントの対応や面接のやり取りなど、細部は記憶ベースで再構成していますが、経緯・結果はすべて事実です。",
      },
      {
        question: "未経験からIT転職するのに資格は必要ですか？",
        answer:
          "筆者は資格なし・プログラミング未経験でIT業界へ転職しました。第二新卒枠はポテンシャル採用が中心のため、資格より「なぜこの業界か」を言語化できることの方が重要です。詳しくは体験談記事で解説しています。",
      },
    ],
    crossLinks: [
      {
        slug: "agent-comparison",
        label: "エージェント比較",
        message:
          "体験談を読んだら、次はエージェント比較へ。筆者が実際に使ったサービスの詳細レビューをまとめています。",
      },
      {
        slug: "industry-guide",
        label: "業界解説",
        message:
          "IT業界やAIO対策業界の構造を知りたい方は、業界解説カテゴリもあわせてどうぞ。",
      },
    ],
  },
  "agent-comparison": {
    name: "エージェント比較",
    label: "エージェント比較",
    description:
      "doda・ワークポート等の転職エージェントを第二新卒が実際に利用した比較記事一覧。各サービスの良い点・注意点をリアルに解説。",
    longDescription:
      "転職エージェントは数が多く、「結局どれを使えばいいの？」と迷う方がほとんどです。このカテゴリでは、筆者が第二新卒として実際に登録・利用したエージェント（doda・ワークポートなど）の使用感を比較形式でまとめています。担当者の対応・求人の質・サポート内容の違いを、利用者目線で率直にレビュー。さらに「転職サイトとエージェントの使い分け」「自己応募との比較」など、サービス選びの判断軸になる記事も揃えています。",
    accentColor: "bg-accent",
    readingOrder: [
      "agent-comparison-2026",
      "agent-site-vs-agent-usage",
    ],
    faq: [
      {
        question: "転職エージェントは本当に無料で使えますか？",
        answer:
          "はい、求職者は完全無料で利用できます。エージェントは企業側から成功報酬を受け取るビジネスモデルのため、求職者に費用は発生しません。途中で利用を中止しても違約金などはありません。",
      },
      {
        question: "エージェントは何社くらい登録すべきですか？",
        answer:
          "2〜3社の併用がおすすめです。1社だけだと求人の偏りや担当者との相性リスクがあり、多すぎると連絡対応が追いつかなくなります。筆者はdodaとワークポートの2社を中心に利用しました。",
      },
      {
        question: "第二新卒におすすめのエージェントはどれですか？",
        answer:
          "筆者の実体験では、dodaは求人数の幅広さとアプリの使いやすさ、ワークポートはIT/Web系求人の豊富さとレスポンスの速さが強みでした。詳しい比較は「エージェント比較」記事をご覧ください。",
      },
    ],
    crossLinks: [
      {
        slug: "taiken",
        label: "体験談",
        message:
          "エージェント比較を読んだら、実際の転職活動の流れを体験談カテゴリで追体験してみてください。",
      },
      {
        slug: "industry-guide",
        label: "業界解説",
        message:
          "エージェントの仕組み自体を深く知りたい方は、業界解説カテゴリの「人材紹介のビジネスモデル」記事もおすすめです。",
      },
    ],
  },
  "industry-guide": {
    name: "業界解説",
    label: "業界解説",
    description:
      "IT/Web業界・AIO対策業界の仕組みや職種を、未経験者向けにわかりやすく解説する記事一覧。",
    longDescription:
      "「IT業界に興味はあるけど、実際どんな仕事があるの？」という疑問に答えるカテゴリです。IT/Web業界の職種・働き方から、AIO対策という新しい領域の仕事内容、転職エージェントのビジネスモデル、第二新卒の制度的な位置づけまで、業界の「そもそも」を未経験者にもわかる言葉で解説しています。体験談やエージェント比較を読む前の予備知識として、あるいは転職活動中の疑問解消に活用してください。",
    accentColor: "bg-gray",
    readingOrder: [
      "what-is-second-new-grad",
      "recruitment-agency-business-model",
      "agent-free-and-cancel",
      "aio-seo-industry-inside",
      "second-new-grad-retirement-pay",
    ],
    faq: [
      {
        question: "IT業界は未経験でも転職できますか？",
        answer:
          "第二新卒枠であれば未経験でも転職可能です。多くのIT企業がポテンシャル採用を行っており、プログラミングスキルや資格がなくても応募できる職種（営業・カスタマーサクセス・マーケティングなど）は多数あります。",
      },
      {
        question: "AIO対策とはどんな仕事ですか？",
        answer:
          "AIO（AI Overview）対策とは、Google検索のAI概要欄に自社の情報が正確に表示されるよう最適化する業務です。SEOの進化系とも言える新しい領域で、コンテンツ制作・構造化データの設計・検索意図の分析などが主な業務内容です。",
      },
      {
        question: "「第二新卒」に明確な定義はありますか？",
        answer:
          "法的な定義はありません。一般的には「新卒入社後おおむね3年以内に転職活動をする若手」を指し、22〜26歳が目安です。企業によって対象範囲は異なるため、求人票の応募条件を確認するのが確実です。",
      },
    ],
    crossLinks: [
      {
        slug: "taiken",
        label: "体験談",
        message:
          "業界の全体像をつかんだら、体験談カテゴリで実際の転職プロセスをチェックしてみてください。",
      },
      {
        slug: "agent-comparison",
        label: "エージェント比較",
        message:
          "転職活動を始める準備ができたら、エージェント比較で自分に合うサービスを見つけましょう。",
      },
    ],
  },
};

export type CategorySlug = keyof typeof CATEGORIES;

export function isValidCategorySlug(slug: string): slug is CategorySlug {
  return slug in CATEGORIES;
}
