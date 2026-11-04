import type { ArticleCategory } from "@/lib/articles";

type CategoryCrossLink = {
  slug: string;
  label: string;
  message: string;
};

/** カテゴリごとの配色（Tailwindクラス）。各画面はここだけを参照する */
type CategoryTheme = {
  /** 記事カード等のカテゴリタグ */
  tag: string;
  /** カテゴリページの「読む順番」番号バッジ */
  badge: string;
  /** 記事ページの見出し・FAQの左罫線 */
  border: string;
  /** 本文H2の左罫線（CSS変数 --category-color に渡す値） */
  cssColor: string;
};

type CategoryDef = {
  name: ArticleCategory;
  label: string;
  /** {authorProfile} は表示時に「N歳・転職1回」へ置き換える（src/lib/author.ts） */
  description: string;
  longDescription: string;
  theme: CategoryTheme;
  readingOrder: string[];
  crossLinks: CategoryCrossLink[];
};

export const CATEGORIES: Record<string, CategoryDef> = {
  taiken: {
    name: "体験談",
    label: "体験談",
    description:
      "{authorProfile}の実体験をベースにした、第二新卒のIT/Web転職の体験談記事一覧。転職を決意した理由から内定獲得までのリアルな記録を掲載。",
    longDescription:
      "このカテゴリでは、24歳・第二新卒として飲食業界からIT/Web業界へ転職した筆者の実体験をすべて公開しています。「転職しようかな」と思い始めた段階から、エージェント登録・書類作成・面接対策・退職交渉・入社後のリアルまで、時系列に沿って追体験できる構成です。体験談だからこそ書ける「実際どうだったか」を軸に、第二新卒が転職活動で直面する場面をひとつずつカバーしています。同じ境遇の方が「次に何をすればいいか」を判断できるよう、読む順番も整理しました。",
    theme: {
      tag: "bg-amber-soft text-amber-ink",
      badge: "bg-surface border border-amber/60 text-amber-ink",
      border: "border-amber",
      cssColor: "var(--amber)",
    },
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
    theme: {
      tag: "bg-primary-soft text-primary",
      badge: "bg-surface border border-primary/50 text-primary",
      border: "border-primary",
      cssColor: "var(--primary)",
    },
    readingOrder: [
      "agent-comparison-2026",
      "agent-site-vs-agent-usage",
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
    theme: {
      tag: "bg-gray-soft text-ink-soft",
      badge: "bg-surface border border-gray text-ink-soft",
      border: "border-gray",
      cssColor: "#8B8D91",
    },
    readingOrder: [
      "what-is-second-new-grad",
      "recruitment-agency-business-model",
      "agent-free-and-cancel",
      "aio-seo-industry-inside",
      "second-new-grad-retirement-pay",
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
  "original-research": {
    name: "独自調査",
    label: "独自調査",
    description:
      "公的データや企業公式情報をNARU独自に収集・集計し、第二新卒×IT/Web転職の見えにくい傾向を検証する記事一覧。",
    longDescription:
      "このカテゴリでは、厚生労働省などの公的データ、企業公式サイト、公開求人などをNARU独自に収集・整理し、通常の解説だけでは見えにくい傾向を検証します。母集団、取得条件、欠損、誤検出などの限界も明記し、数字だけを切り取って断定しません。『実際に調べるとどう見えるか』を、第二新卒の企業選びや転職活動に使える形へ落とし込んでいます。",
    theme: {
      tag: "bg-research-soft text-research-ink",
      badge: "bg-surface border border-research/50 text-research-ink",
      border: "border-research",
      cssColor: "#7A4E61",
    },
    readingOrder: [
      "it-company-recruitment-page-research",
    ],
    crossLinks: [
      {
        slug: "industry-guide",
        label: "業界解説",
        message:
          "調査で見えた傾向の背景を体系的に知りたい方は、業界解説カテゴリもあわせてどうぞ。",
      },
      {
        slug: "zakki",
        label: "雑記",
        message:
          "直近ニュースや話題からキャリアの論点を考えたい方は、雑記カテゴリもチェックしてみてください。",
      },
    ],
  },
  zakki: {
    name: "雑記",
    label: "雑記",
    description:
      "話題になった転職・退職のニュースや、第二新卒のキャリアにまつわる気づきを気軽にまとめた雑記記事一覧。",
    longDescription:
      "このカテゴリでは、体験談・エージェント比較・業界解説のどれにも収まりきらない話題をまとめています。SNSで話題になった退職報告や転職ニュースをきっかけに、第二新卒として考えておきたいキャリアの論点を、筆者の視点で気軽に掘り下げます。気になったテーマから自由に読んでみてください。",
    theme: {
      tag: "bg-navy-soft text-navy",
      badge: "bg-surface border border-navy/50 text-navy",
      border: "border-navy",
      cssColor: "#2F4A6B",
    },
    readingOrder: [],
    crossLinks: [
      {
        slug: "taiken",
        label: "体験談",
        message:
          "実際の転職活動の流れを知りたい方は、体験談カテゴリで筆者の転職プロセスを追体験してみてください。",
      },
      {
        slug: "industry-guide",
        label: "業界解説",
        message:
          "第二新卒の位置づけや業界の仕組みを体系的に知りたい方は、業界解説カテゴリもあわせてどうぞ。",
      },
    ],
  },
};

export type CategorySlug = keyof typeof CATEGORIES;

const SLUG_BY_NAME = new Map<string, string>(
  Object.entries(CATEGORIES).map(([slug, cat]) => [cat.name, slug])
);

/** カテゴリ名 → カテゴリページのslug */
export function getCategorySlug(name: string): string | undefined {
  return SLUG_BY_NAME.get(name);
}

/** カテゴリ名から配色を引く。未知のカテゴリは業界解説の配色にフォールバック */
export function getCategoryTheme(name: string): CategoryTheme {
  const slug = SLUG_BY_NAME.get(name) ?? "industry-guide";
  return CATEGORIES[slug].theme;
}

export function isValidCategorySlug(slug: string): slug is CategorySlug {
  return slug in CATEGORIES;
}
