export interface HubArticle {
  slug: string;
  title: string;
}

const ARTICLES: Record<string, HubArticle> = {
  "second-new-grad-it-career-change": { slug: "second-new-grad-it-career-change", title: "第二新卒がIT業界に転職するための完全ガイド" },
  "second-new-grad-programming-career-change": { slug: "second-new-grad-programming-career-change", title: "プログラミング未経験でもIT転職できる？" },
  "what-is-web-industry": { slug: "what-is-web-industry", title: "Web業界とは？職種・働き方・将来性" },
  "aio-seo-industry-inside": { slug: "aio-seo-industry-inside", title: "AIO対策企業に営業職で入社した話" },
  "it-industry-quit-myth": { slug: "it-industry-quit-myth", title: "「IT業界はやめとけ」と言われて転職した僕が思うこと" },
  "skill-based-hiring": { slug: "skill-based-hiring", title: "スキルベース採用とは？" },
  "interview-failure-why-this-job": { slug: "interview-failure-why-this-job", title: "面接で「なぜこの職種を志望するのか」と詰まった話" },
  "agent-comparison-2026": { slug: "agent-comparison-2026", title: "転職エージェント比較——doda・ワークポート" },
  "agent-referral-vs-self-apply": { slug: "agent-referral-vs-self-apply", title: "エージェント紹介 vs 自己応募" },
  "job-change-timing-3months": { slug: "job-change-timing-3months", title: "転職タイミング、僕が動いた3ヶ月間の記録" },
  "casual-interview": { slug: "casual-interview", title: "カジュアル面談とは？" },
  "direct-recruiting": { slug: "direct-recruiting", title: "ダイレクトリクルーティングとは？" },
  "agent-site-vs-agent-usage": { slug: "agent-site-vs-agent-usage", title: "転職サイトとエージェントの使い分け方" },
  "ai-interview-screening": { slug: "ai-interview-screening", title: "AI面接・適性検査とは？" },
  "reference-check-explained": { slug: "reference-check-explained", title: "リファレンスチェックとは？" },
  "it-web-industry-real-work-culture": { slug: "it-web-industry-real-work-culture", title: "IT/Web業界のリアルな働き方・文化" },
  "recruitment-agency-business-model": { slug: "recruitment-agency-business-model", title: "転職エージェントはなぜ無料なのか" },
  "how-to-resign-experience": { slug: "how-to-resign-experience", title: "退職の伝え方、有給・ボーナスの実体験" },
  "agent-free-and-cancel": { slug: "agent-free-and-cancel", title: "エージェントは本当に無料？断ってもいい？" },
  "second-new-grad-job-change-traps": { slug: "second-new-grad-job-change-traps", title: "第二新卒が陥りやすい転職の罠と回避策" },
  "what-is-second-new-grad": { slug: "what-is-second-new-grad", title: "第二新卒とは？定義・年齢の目安" },
  "alumni-hiring": { slug: "alumni-hiring", title: "アルムナイ採用とは？" },
  "second-new-grad-retirement-pay": { slug: "second-new-grad-retirement-pay", title: "第二新卒に退職金は出ない？" },
  "resume-writing-second-new-grad": { slug: "resume-writing-second-new-grad", title: "職務経歴書、第二新卒の書き方" },
  "job-type-employment": { slug: "job-type-employment", title: "ジョブ型雇用とは？" },
  "ses-explained": { slug: "ses-explained", title: "SESとは？" },
  "bizreach-second-new-grad": { slug: "bizreach-second-new-grad", title: "ビズリーチは第二新卒でも使える？" },
};

// タイプID → おすすめ記事スラッグ（5〜8本）
const TYPE_HUB_ARTICLES: Record<number, string[]> = {
  // 企画・技術・変革系
  1: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change", "what-is-web-industry", "aio-seo-industry-inside", "it-industry-quit-myth", "skill-based-hiring"],
  5: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change", "what-is-web-industry", "aio-seo-industry-inside", "it-industry-quit-myth", "skill-based-hiring"],
  15: ["second-new-grad-it-career-change", "second-new-grad-programming-career-change", "what-is-web-industry", "aio-seo-industry-inside", "it-industry-quit-myth", "skill-based-hiring"],
  // 営業・リーダー系
  2: ["interview-failure-why-this-job", "agent-comparison-2026", "agent-referral-vs-self-apply", "job-change-timing-3months", "casual-interview", "direct-recruiting"],
  8: ["interview-failure-why-this-job", "agent-comparison-2026", "agent-referral-vs-self-apply", "job-change-timing-3months", "casual-interview", "direct-recruiting"],
  14: ["interview-failure-why-this-job", "agent-comparison-2026", "agent-referral-vs-self-apply", "job-change-timing-3months", "casual-interview", "direct-recruiting"],
  6: ["interview-failure-why-this-job", "agent-comparison-2026", "agent-referral-vs-self-apply", "job-change-timing-3months", "casual-interview", "direct-recruiting"],
  // 分析・調査系
  3: ["what-is-web-industry", "agent-site-vs-agent-usage", "ai-interview-screening", "reference-check-explained", "it-web-industry-real-work-culture", "recruitment-agency-business-model"],
  9: ["what-is-web-industry", "agent-site-vs-agent-usage", "ai-interview-screening", "reference-check-explained", "it-web-industry-real-work-culture", "recruitment-agency-business-model"],
  13: ["what-is-web-industry", "agent-site-vs-agent-usage", "ai-interview-screening", "reference-check-explained", "it-web-industry-real-work-culture", "recruitment-agency-business-model"],
  // 人・組織系
  4: ["how-to-resign-experience", "agent-free-and-cancel", "second-new-grad-job-change-traps", "what-is-second-new-grad", "alumni-hiring", "second-new-grad-retirement-pay"],
  12: ["how-to-resign-experience", "agent-free-and-cancel", "second-new-grad-job-change-traps", "what-is-second-new-grad", "alumni-hiring", "second-new-grad-retirement-pay"],
  16: ["how-to-resign-experience", "agent-free-and-cancel", "second-new-grad-job-change-traps", "what-is-second-new-grad", "alumni-hiring", "second-new-grad-retirement-pay"],
  // 堅実・専門系
  7: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps", "job-type-employment", "ses-explained", "bizreach-second-new-grad", "agent-comparison-2026"],
  10: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps", "job-type-employment", "ses-explained", "bizreach-second-new-grad", "agent-comparison-2026"],
  11: ["resume-writing-second-new-grad", "second-new-grad-job-change-traps", "job-type-employment", "ses-explained", "bizreach-second-new-grad", "agent-comparison-2026"],
};

export function getHubArticles(typeId: number): HubArticle[] {
  const slugs = TYPE_HUB_ARTICLES[typeId] || TYPE_HUB_ARTICLES[1];
  return slugs.map((s) => ARTICLES[s]).filter(Boolean);
}
