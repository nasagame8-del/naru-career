import { describe, expect, it } from "vitest";
import { AFFILIATE_CREATIVES, ARTICLE_AD_SERVICES, getAffiliateCreative } from "./affiliate-creatives";

describe("user supplied affiliate creatives", () => {
  it("keeps each AccessTrade link paired with its own impression URL and original dimensions", () => {
    const supplied: Record<string, [string, number, number]> = {
      uzuz_rectangle: ["0100pw7i00ovm3", 300, 250],
      uzuz_small_horizontal: ["0100pw7h00ovm3", 234, 60],
      uzuz_square: ["0100pw7g00ovm3", 200, 200],
      jobs_small_horizontal: ["0100q25q00ovm3", 120, 60],
      jobs_square: ["0100q25r00ovm3", 250, 250],
      jobs_rectangle: ["0100q25s00ovm3", 300, 250],
      zen_small_horizontal: ["0100q5nd00ovm3", 120, 60],
      zen_rectangle: ["0100q5ne00ovm3", 300, 250],
      zen_square: ["0100q5nf00ovm3", 250, 250],
    };
    for (const [key, [rk, width, height]] of Object.entries(supplied)) {
      const creative = AFFILIATE_CREATIVES[key];
      expect(creative.href).toBe(`https://h.accesstrade.net/sp/cc?rk=${rk}`);
      expect(creative.image).toBe(`https://h.accesstrade.net/sp/rr?rk=${rk}`);
      expect([creative.width, creative.height]).toEqual([width, height]);
      expect(creative.referrerPolicy).toBe("no-referrer-when-downgrade");
      expect(creative.pixel).toBeUndefined();
    }
  });
  it("selects the mobile creative without stretching it and preserves A8 tracking", () => {
    expect(getAffiliateCreative("uzuz", "article_sidebar").width).toBe(300);
    expect(getAffiliateCreative("uzuz", "article_end_mobile").width).toBe(200);
    for (const service of Object.values(ARTICLE_AD_SERVICES)) {
      expect(AFFILIATE_CREATIVES[service.sidebar]).toBeDefined();
      expect(AFFILIATE_CREATIVES[service.mobile]).toBeDefined();
    }
    expect(getAffiliateCreative("kosmo", "article_sidebar").pixel).toContain("www17.a8.net/0.gif");
    expect(getAffiliateCreative("anycrew", "article_sidebar").pixel).toContain("www16.a8.net/0.gif");
  });
});
