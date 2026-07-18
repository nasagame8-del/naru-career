// 用語集（/glossary）の各項目に対応するアンカーID と、
// 記事本文中でインライン定義（<dfn>）としてマークアップする際のマッチ文字列を
// 一元管理するモジュール。glossary ページと articles.ts の両方から参照する。

export type GlossaryMatcher = {
  // 用語集ページ側の見出しラベル（例: "SESとは"）
  label: string;
  // 用語集ページの該当項目へリンクするためのアンカーID
  anchor: string;
  // 記事本文中でこの用語にマッチさせる表記（長い順にマッチさせる）
  aliases: string[];
};

export const GLOSSARY_MATCHERS: GlossaryMatcher[] = [
  { label: "ダイレクトリクルーティングとは", anchor: "term-direct-recruiting", aliases: ["ダイレクトリクルーティング"] },
  { label: "メンバーシップ型雇用とは", anchor: "term-membership", aliases: ["メンバーシップ型雇用"] },
  { label: "スキルベース採用とは", anchor: "term-skill-based", aliases: ["スキルベース採用"] },
  { label: "アルムナイ採用とは", anchor: "term-alumni", aliases: ["アルムナイ採用"] },
  { label: "ポテンシャル採用とは", anchor: "term-potential", aliases: ["ポテンシャル採用"] },
  { label: "リファラル採用とは", anchor: "term-referral", aliases: ["リファラル採用"] },
  { label: "スカウト型サービスとは", anchor: "term-scout", aliases: ["スカウト型サービス"] },
  { label: "カスタマーサクセスとは", anchor: "term-cs", aliases: ["カスタマーサクセス"] },
  { label: "キャリアアドバイザーとは", anchor: "term-ca", aliases: ["キャリアアドバイザー"] },
  { label: "ジョブ型雇用とは", anchor: "term-job", aliases: ["ジョブ型雇用"] },
  { label: "カジュアル面談とは", anchor: "term-casual", aliases: ["カジュアル面談"] },
  { label: "RPO（採用代行）とは", anchor: "term-rpo", aliases: ["RPO（採用代行）", "RPO"] },
  { label: "非公開求人とは", anchor: "term-hikoukai", aliases: ["非公開求人"] },
  { label: "自社開発とは", anchor: "term-jisha", aliases: ["自社開発"] },
  { label: "受託開発とは", anchor: "term-jutaku", aliases: ["受託開発"] },
  { label: "AI面接とは", anchor: "term-ai-mensetsu", aliases: ["AI面接"] },
  { label: "既卒とは", anchor: "term-kisotsu", aliases: ["既卒"] },
  { label: "SIerとは", anchor: "term-sier", aliases: ["SIer"] },
  { label: "SESとは", anchor: "term-ses", aliases: ["SES"] },
];

// 用語集ラベル → アンカーID の対応表（glossary ページ側で id を付与するために使用）
export const GLOSSARY_ANCHORS: Record<string, string> = Object.fromEntries(
  GLOSSARY_MATCHERS.map((m) => [m.label, m.anchor])
);
