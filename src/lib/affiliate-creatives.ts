import type { ArticleAd } from "./article-ads";

export type AffiliateCreative = {
  href: string;
  image: string;
  valueCommercePid?: string;
  alt: string;
  width: number;
  height: number;
  pixel?: string;
  referrerPolicy?: "no-referrer-when-downgrade";
};

/** User-supplied ASP code. Size variants have independent tracking codes. Never resize. */
export const AFFILIATE_CREATIVES: Record<string, AffiliateCreative> = {
  techclips_rectangle: {
    valueCommercePid: "892743441",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743441",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743441",
    alt: "TechClipsエージェント（広告）", width: 300, height: 250,
  },
  techclips_horizontal: {
    valueCommercePid: "892743442",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743442",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743442",
    alt: "TechClipsエージェント（広告）", width: 468, height: 60,
  },
  geekly_horizontal: {
    valueCommercePid: "892743444",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743444",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743444",
    alt: "Geekly（広告）", width: 468, height: 60,
  },
  geekly_tall: {
    valueCommercePid: "892743445",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743445",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743445",
    alt: "Geekly（広告）", width: 160, height: 600,
  },
  geekly_square: {
    valueCommercePid: "892743446",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743446",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743446",
    alt: "Geekly（広告）", width: 250, height: 250,
  },
  assign_square: {
    valueCommercePid: "892743448",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743448",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743448",
    alt: "ASSIGN（広告）", width: 300, height: 300,
  },
  recruit_horizontal: {
    valueCommercePid: "892743449",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743449",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743449",
    alt: "リクルートエージェント（広告）", width: 728, height: 90,
  },
  recruit_rectangle: {
    valueCommercePid: "892743450",
    href: "//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743450",
    image: "//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743450",
    alt: "リクルートエージェント（広告）", width: 300, height: 250,
  },
  uzuz_rectangle: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100pw7i00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100pw7i00ovm3",
    alt: "第二新卒・既卒・フリーター・ニートの就職サポート【UZUZ】", width: 300, height: 250,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  uzuz_small_horizontal: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100pw7h00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100pw7h00ovm3",
    alt: "第二新卒・既卒・フリーター・ニートの就職サポート【UZUZ】", width: 234, height: 60,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  uzuz_square: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100pw7g00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100pw7g00ovm3",
    alt: "第二新卒・既卒・フリーター・ニートの就職サポート【UZUZ】", width: 200, height: 200,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  jobs_small_horizontal: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q25q00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q25q00ovm3",
    alt: "退職代行Jobs", width: 120, height: 60,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  jobs_square: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q25r00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q25r00ovm3",
    alt: "退職代行Jobs", width: 250, height: 250,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  jobs_rectangle: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q25s00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q25s00ovm3",
    alt: "退職代行Jobs", width: 300, height: 250,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  zen_small_horizontal: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q5nd00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q5nd00ovm3",
    alt: "ZENの退職代行", width: 120, height: 60,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  zen_rectangle: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q5ne00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q5ne00ovm3",
    alt: "ZENの退職代行", width: 300, height: 250,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  zen_square: {
    href: "https://h.accesstrade.net/sp/cc?rk=0100q5nf00ovm3",
    image: "https://h.accesstrade.net/sp/rr?rk=0100q5nf00ovm3",
    alt: "ZENの退職代行", width: 250, height: 250,
    referrerPolicy: "no-referrer-when-downgrade",
  },
  kosmo_rectangle: {
    href: "https://px.a8.net/svt/ejp?a8mat=4BEHXF+56CP4I+59SS+BXIYP",
    image: "https://www22.a8.net/svt/bgt?aid=261016899313&wid=001&eno=01&mid=s00000024598002004000&mc=1",
    pixel: "https://www17.a8.net/0.gif?a8mat=4BEHXF+56CP4I+59SS+BXIYP",
    alt: "KOSMOのサービス案内（広告）", width: 300, height: 250,
  },
  anycrew_rectangle: {
    href: "https://px.a8.net/svt/ejp?a8mat=4BEHXF+53YYPE+4V6Y+5ZMCH",
    image: "https://www25.a8.net/svt/bgt?aid=261016899309&wid=001&eno=01&mid=s00000022705001006000&mc=1",
    pixel: "https://www16.a8.net/0.gif?a8mat=4BEHXF+53YYPE+4V6Y+5ZMCH",
    alt: "Anycrewのサービス案内（広告）", width: 300, height: 250,
  },
};

export const ARTICLE_AD_SERVICES: Record<ArticleAd, {
  name: string; sidebar: string; mobile: string; description: string;
}> = {
  techclips: { name: "TechClipsエージェント", sidebar: "techclips_rectangle", mobile: "techclips_rectangle",
    description: "ITエンジニアとしての経験を活かし、SIer・SESから事業会社などへの転職を考えている方へ。TechClipsエージェントの広告です。対象条件は公式ページでご確認ください。" },
  geekly: { name: "Geekly", sidebar: "geekly_square", mobile: "geekly_square",
    description: "IT・Web業界での経験を活かして次の職場を探している方へ。Geeklyの転職サポートの広告です。紹介可能な職種・経験条件は公式ページでご確認ください。" },
  assign: { name: "ASSIGN", sidebar: "assign_square", mobile: "assign_square",
    description: "これまでの経験を踏まえ、キャリアの選択肢を整理したい方へ。若手ハイエンド向け転職サイトASSIGNの広告です。対象条件は公式ページでご確認ください。" },
  recruit_agent: { name: "リクルートエージェント", sidebar: "recruit_rectangle", mobile: "recruit_rectangle",
    description: "働き方や応募先の条件を整理し、転職先の候補を相談したい方へ。リクルートエージェントの広告です。利用条件や紹介可能な求人は公式ページでご確認ください。" },
  kosmo: { name: "KOSMO", sidebar: "kosmo_rectangle", mobile: "kosmo_rectangle",
    description: "転職先の候補や応募準備を相談したい方へ。KOSMOの転職サポート案内です。利用条件は公式ページでご確認ください。" },
  anycrew: { name: "Anycrew", sidebar: "anycrew_rectangle", mobile: "anycrew_rectangle",
    description: "契約上の制限を確認したうえで、副業・業務委託の案件を探したい方へ。Anycrewの案内です。" },
  uzuz: { name: "UZUZ", sidebar: "uzuz_rectangle", mobile: "uzuz_square",
    description: "第二新卒・既卒などの就職サポートを探している方へ。UZUZの案内です。対象条件や支援内容は公式ページでご確認ください。" },
  retirement_jobs: { name: "退職代行Jobs", sidebar: "jobs_rectangle", mobile: "jobs_square",
    description: "自分で退職を伝えるのが難しく、代行を検討している方へ。退職代行Jobsの案内です。対応範囲・料金・契約条件は公式ページでご確認ください。" },
  retirement_zen: { name: "ZENの退職代行", sidebar: "zen_rectangle", mobile: "zen_square",
    description: "退職代行を比較している方へ。ZENの退職代行の案内です。対応範囲・料金・契約条件は公式ページでご確認ください。" },
};

export type AffiliatePlacement = "article_sidebar" | "article_end_mobile" | "article_body_mobile";

export function getAffiliateCreative(ad: ArticleAd, placement: AffiliatePlacement) {
  const service = ARTICLE_AD_SERVICES[ad];
  return AFFILIATE_CREATIVES[placement === "article_sidebar" ? service.sidebar : service.mobile];
}
