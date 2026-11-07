import type { ArticleAd } from "@/lib/article-ads";

const creatives = {
  kosmo: {
    name: "KOSMO",
    href: "https://px.a8.net/svt/ejp?a8mat=4BEHXF+56CP4I+59SS+BXIYP",
    image: "https://www22.a8.net/svt/bgt?aid=261016899313&wid=001&eno=01&mid=s00000024598002004000&mc=1",
    pixel: "https://www17.a8.net/0.gif?a8mat=4BEHXF+56CP4I+59SS+BXIYP",
    description: "転職先の候補や応募準備を相談したい方へ。KOSMOの転職サポート案内です。利用条件は公式ページでご確認ください。",
  },
  anycrew: {
    name: "Anycrew",
    href: "https://px.a8.net/svt/ejp?a8mat=4BEHXF+53YYPE+4V6Y+5ZMCH",
    image: "https://www25.a8.net/svt/bgt?aid=261016899309&wid=001&eno=01&mid=s00000022705001006000&mc=1",
    pixel: "https://www16.a8.net/0.gif?a8mat=4BEHXF+53YYPE+4V6Y+5ZMCH",
    description: "契約上の制限を確認したうえで、副業・業務委託の案件を探したい方へ。Anycrewの案内です。",
  },
} as const;

export function AffiliateBanner({ ad, placement, slug, className = "" }: {
  ad: ArticleAd;
  placement: "article_sidebar" | "article_end_mobile";
  slug: string;
  className?: string;
}) {
  const creative = creatives[ad];
  const description = ad === "kosmo" && ["contractor-how-to-quit", "outsourcing-contract-termination-worker-status"].includes(slug)
    ? "契約終了の手続きや必要な相談先を確認したうえで、次は雇用される働き方を検討したい方へ。KOSMOの転職サポート案内です。契約トラブルの相談窓口ではありません。"
    : creative.description;
  return (
    <section aria-label={`広告：${creative.name}`} className={`border-t border-line pt-5 ${className}`}>
      <p className="mb-3 text-[11px] text-ink-soft">広告（PR）｜{creative.name}</p>
      {placement === "article_end_mobile" && <p className="mb-4 text-sm leading-relaxed text-ink-soft">{description}</p>}
      <a href={creative.href} rel="nofollow sponsored"
        data-track-event="cta_click" data-track-agent_name={creative.name}
        data-track-format="banner" data-track-placement={placement} data-track-article_slug={slug}
        className="block" style={{ width: 300, marginLeft: "calc(50% - 150px)" }}>
        {/* ASP素材は最適化・縮小せず、指定の300×250で配信する。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creative.image} alt={`${creative.name}のサービス案内（広告）`}
          width={300} height={250} loading="lazy" decoding="async"
          style={{ width: 300, height: 250, maxWidth: "none" }} />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={creative.pixel} alt="" width={1} height={1} loading="lazy"
        style={{ width: 1, height: 1, margin: 0, border: 0 }} />
    </section>
  );
}
