/** Explicit mobile-placement pilot. Unknown/moved anchors keep the existing footer ad. */
const CONTEXTUAL_MOBILE_ADS: Readonly<Partial<Record<string, {
  tag: "h2" | "p";
  text: string;
  intro: string;
}>>> = {
  "second-new-grad-it-company-research": {
    tag: "h2",
    text: "まとめ：分からないことを残すのも企業研究",
    intro: "企業研究をしたうえで、応募先や仕事選びを第三者に相談したい方へ。UZUZの就職サポート案内です。対象条件・支援内容は公式ページでご確認ください。",
  },
  "second-new-grad-it-portfolio-guide": {
    tag: "h2",
    text: "まとめ：作品数を増やす前に、職種と説明内容を合わせよう",
    intro: "成果物と応募職種の接点を整理したうえで、就職サポートも検討したい方へ。UZUZの案内です。対象条件・支援内容は公式ページでご確認ください。",
  },
  "employee-contractor-pay-comparison": {
    tag: "p",
    text: "報酬が上がるという説明は、検討の入口です。何が増え、何を自分が引き受けるのか、そして働き方の実態に問題がないかを確認できて初めて、応じるかどうかを考える材料になります。",
    intro: "契約・収支の比較と必要な窓口への相談を進めたうえで、別の会社で雇用される働き方も検討したい方へ。リクルートエージェントの案内です。契約・税・保険の相談窓口とは用途が異なります。",
  },
};

export function getContextualMobileAd(slug: string, contentHtml: string): { index: number; intro: string } | null {
  const config = Object.hasOwn(CONTEXTUAL_MOBILE_ADS, slug) ? CONTEXTUAL_MOBILE_ADS[slug] : undefined;
  if (!config) return null;
  const re = new RegExp(`<${config.tag}\\b[^>]*>([\\s\\S]*?)<\\/${config.tag}>`, "g");
  const matches = [...contentHtml.matchAll(re)].filter(match => match[1].replace(/<[^>]+>/g, "").trim() === config.text);
  if (matches.length !== 1 || !matches[0].index) return null;
  return { index: matches[0].index, intro: config.intro };
}
