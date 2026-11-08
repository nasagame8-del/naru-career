/** Original user-supplied codes. Do not replace jsbanner with its noscript fallback. */
export const VALUECOMMERCE_BANNER_PIDS = [
  "892743441", "892743442", "892743444", "892743445", "892743446", "892743448", "892743449", "892743450",
] as const;

export function getValueCommerceBannerCode(pid: string): string {
  if (!(VALUECOMMERCE_BANNER_PIDS as readonly string[]).includes(pid)) throw new Error("Unknown ValueCommerce creative");
  return `<script language="javascript" src="//ad.jp.ap.valuecommerce.com/servlet/jsbanner?sid=3775939&pid=${pid}"></script><noscript><a href="//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=${pid}" rel="nofollow"><img src="//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=${pid}" border="0"></a></noscript>`;
}

export const VALUECOMMERCE_TEXT_CODES: Readonly<Record<string, string>> = {
  "892743441": '<a href="//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743443" rel="nofollow"><img src="//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743443" height="1" width="1" border="0">ITエンジニア専門の転職エージェント【TechClipsエージェント】</a>',
  "892743448": '<a href="//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=892743447" rel="nofollow"><img src="//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3775939&pid=892743447" height="1" width="1" border="0">若手ハイエンド向け転職サイト『ASSIGN』</a>',
};

/** A separate parser context supports the ASP's document.write on SSR and client navigation. */
export function getValueCommerceDocument(pid: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex"><style>html,body{margin:0;padding:0}img{display:block;border:0}</style></head><body>${getValueCommerceBannerCode(pid)}</body></html>`;
}
