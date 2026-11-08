import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AffiliateBanner } from "../components/AffiliateBanner";
import { AFFILIATE_CREATIVES } from "./affiliate-creatives";
import { getArticleAd, shouldShowMobileArticleAd } from "./article-ads";
import { getValueCommerceBannerCode, VALUECOMMERCE_BANNER_PIDS, VALUECOMMERCE_TEXT_CODES } from "./valuecommerce";

describe("ValueCommerce original creatives", () => {
  it("pairs each supplied script and noscript without extracting the fallback", () => {
    for (const pid of VALUECOMMERCE_BANNER_PIDS) {
      const code = getValueCommerceBannerCode(pid);
      expect(code).toContain(`jsbanner?sid=3775939&pid=${pid}`);
      expect(code).toContain(`<noscript><a href="//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3775939&pid=${pid}" rel="nofollow">`);
      expect(code).toContain(`gifbanner?sid=3775939&pid=${pid}" border="0"></a></noscript>`);
    }
    expect(() => getValueCommerceBannerCode('" onload="alert(1)')).toThrow();
  });
  it("keeps the original text impression pixel inside each supplied link", () => {
    expect(VALUECOMMERCE_TEXT_CODES["892743441"]).toContain('pid=892743443" height="1" width="1" border="0">ITエンジニア');
    expect(VALUECOMMERCE_TEXT_CODES["892743448"]).toContain('pid=892743447" height="1" width="1" border="0">若手ハイエンド');
  });
  it("renders executable iframe documents with original dimensions and PR", () => {
    for (const ad of ["techclips", "geekly", "assign", "recruit_agent"] as const) {
      const html = renderToStaticMarkup(createElement(AffiliateBanner, { ad, slug: "example", placement: "article_sidebar" }));
      expect(html).toContain('srcDoc=');
      expect(html).toContain('広告（PR）');
      expect(html).not.toContain('data-track-format="banner"'); // Frame clicks are not measured by the parent listener.
    }
    expect(AFFILIATE_CREATIVES.geekly_square.width).toBe(250);
    expect(AFFILIATE_CREATIVES.assign_square.height).toBe(300);
    expect(getArticleAd("employee-contractor-pay-comparison")).toBe("recruit_agent");
    expect(shouldShowMobileArticleAd("ses-explained")).toBe(false);
    expect(getArticleAd("second-new-grad-programming-career-change")).toBeUndefined();
  });
});
