import { ValueCommerceAd } from "./ValueCommerceAd";
import type { ArticleAd } from "@/lib/article-ads";
import { ARTICLE_AD_SERVICES, getAffiliateCreative, type AffiliatePlacement } from "@/lib/affiliate-creatives";

export function AffiliateBanner({ ad, placement, slug, className = "", intro }: {
  ad: ArticleAd;
  placement: AffiliatePlacement;
  slug: string;
  className?: string;
  intro?: string;
}) {
  const service = ARTICLE_AD_SERVICES[ad];
  const creative = getAffiliateCreative(ad, placement);
  const description = intro ?? (ad === "kosmo" && ["contractor-how-to-quit", "outsourcing-contract-termination-worker-status", "business-outsourcing-conversion-risk", "employee-to-contractor-unemployment-benefit", "employee-to-contractor-social-insurance"].includes(slug)
    ? "現在の契約や制度を確認し、必要な窓口へ相談したうえで、雇用される働き方も検討したい方へ。KOSMOの転職サポート案内です。契約トラブルの相談窓口ではありません。"
    : service.description);
  return (
    <section aria-label={`広告：${service.name}`} className={`border-t border-line pt-5 ${className}`}>
      <p className="mb-3 text-[11px] text-ink-soft">広告（PR）｜{service.name}</p>
      {placement !== "article_sidebar" && <p className="mb-4 text-sm leading-relaxed text-ink-soft">{description}</p>}
      {creative.valueCommercePid ? <ValueCommerceAd pid={creative.valueCommercePid} width={creative.width} height={creative.height} name={service.name} /> : <>
      <a href={creative.href} rel="nofollow sponsored" referrerPolicy={creative.referrerPolicy}
        data-track-event="cta_click" data-track-agent_name={service.name}
        data-track-format="banner" data-track-placement={placement} data-track-article_slug={slug}
        className="block" style={{ width: creative.width, marginLeft: `calc(50% - ${creative.width / 2}px)` }}>
        {/* ASP素材は最適化・縮小せず、指定寸法で配信する。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creative.image} alt={creative.alt}
          width={creative.width} height={creative.height} loading="lazy" decoding="async"
          style={{ width: creative.width, height: creative.height, maxWidth: "none" }} />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {creative.pixel && <img src={creative.pixel} alt="" width={1} height={1} loading="lazy"
        style={{ width: 1, height: 1, margin: 0, border: 0 }} />}
      </>}
    </section>
  );
}
