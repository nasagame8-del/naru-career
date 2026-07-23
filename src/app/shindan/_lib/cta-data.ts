const UTM = "utm_source=shindan&utm_medium=referral&utm_campaign=tekishoku";
const NARU = "https://naru-career.com";

export interface ArticleLink {
  slug: string;
  title: string;
  desc: string;
}

const ARTICLES: Record<string, ArticleLink> = {
  "second-new-grad-it-career-change": {
    slug: "second-new-grad-it-career-change",
    title: "第二新卒がIT業界に転職するための完全ガイド【実体験ベース】",
    desc: "未経験からIT/Web業界への転職ロードマップ",
  },
  "second-new-grad-programming-career-change": {
    slug: "second-new-grad-programming-career-change",
    title: "第二新卒×プログラミング未経験でもIT転職できる？",
    desc: "プログラミング未経験からの転職体験談",
  },
  "interview-failure-why-this-job": {
    slug: "interview-failure-why-this-job",
    title: "面接で「なぜこの職種を志望するのか」と聞かれて詰まった話",
    desc: "営業職の面接で失敗した実体験と対策",
  },
  "agent-comparison-2026": {
    slug: "agent-comparison-2026",
    title: "第二新卒の転職で使ったエージェント比較——doda・ワークポート",
    desc: "実際に使ったエージェントのリアルな感想",
  },
  "what-is-web-industry": {
    slug: "what-is-web-industry",
    title: "Web業界とは？未経験から目指す人が知っておくべき職種・将来性",
    desc: "Web業界の全体像と職種マップ",
  },
  "agent-site-vs-agent-usage": {
    slug: "agent-site-vs-agent-usage",
    title: "転職サイトとエージェント、両方使って分かった使い分け方",
    desc: "doda・ワークポートの実体験による比較",
  },
  "how-to-resign-experience": {
    slug: "how-to-resign-experience",
    title: "退職の伝え方、有給・ボーナスはどうだった？——退職実体験",
    desc: "第二新卒の退職までのリアルな流れ",
  },
  "agent-free-and-cancel": {
    slug: "agent-free-and-cancel",
    title: "転職エージェントは本当に無料？途中で断ってもいい？",
    desc: "実体験と業界知識から解説",
  },
  "resume-writing-second-new-grad": {
    slug: "resume-writing-second-new-grad",
    title: "職務経歴書、第二新卒はここで差がつく——僕の書き方",
    desc: "飲食業界からIT転職した際の職務経歴書の工夫",
  },
  "second-new-grad-job-change-traps": {
    slug: "second-new-grad-job-change-traps",
    title: "第二新卒が陥りやすい転職の罠と回避策",
    desc: "僕の失敗から学んだ注意点",
  },
};

// タイプID → おすすめ記事2本
const TYPE_ARTICLE_MAP: Record<number, [string, string]> = {
  1: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change"],
  5: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change"],
  15: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change"],
  2: ["interview-failure-why-this-job", "agent-comparison-2026"],
  8: ["interview-failure-why-this-job", "agent-comparison-2026"],
  14: ["interview-failure-why-this-job", "agent-comparison-2026"],
  6: ["interview-failure-why-this-job", "agent-comparison-2026"],
  3: ["what-is-web-industry", "agent-site-vs-agent-usage"],
  9: ["what-is-web-industry", "agent-site-vs-agent-usage"],
  13: ["what-is-web-industry", "agent-site-vs-agent-usage"],
  4: ["how-to-resign-experience", "agent-free-and-cancel"],
  12: ["how-to-resign-experience", "agent-free-and-cancel"],
  16: ["how-to-resign-experience", "agent-free-and-cancel"],
  7: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps"],
  10: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps"],
  11: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps"],
};

export function getArticlesForType(typeId: number): ArticleLink[] {
  const slugs = TYPE_ARTICLE_MAP[typeId] || TYPE_ARTICLE_MAP[1];
  return slugs.map((s) => ARTICLES[s]);
}

export function naruArticleUrl(slug: string): string {
  return `${NARU}/articles/${slug}?${UTM}`;
}

export const NARU_TOP_URL = `${NARU}?${UTM}`;

export const SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScDn4OFzXXGVQ7kOwEN8B1ctymOTfEdV5ml_21noJ6f4whYNw/viewform";

// ユメキャリ: 営業系タイプ(2,8,14,6)のみ表示
export const YUMECAREER_TYPE_IDS = new Set([2, 8, 14, 6]);

// プレースホルダ: A8計測URLをここに差し替え
export const YUMECAREER_URL = "https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892664088";

export const AFFILIATE_DISCLOSURE =
  "当サイトは一部のリンクにアフィリエイト広告を利用しています。リンクを経由して商品・サービスの申し込みがあった場合、当サイトに報酬が支払われることがあります。ただし、記事の内容やランキングへの影響は一切ありません。広告の有無にかかわらず、実体験に基づいた正確な情報を提供しています。詳細はプライバシーポリシーをご覧ください。";
