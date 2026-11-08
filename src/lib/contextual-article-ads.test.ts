import { describe, expect, it } from "vitest";
import { getArticle } from "./articles";
import { getContextualMobileAd } from "./contextual-article-ads";

describe("contextual mobile ad pilot", () => {
  it("places ads after the useful instructions without changing article content", async () => {
    for (const slug of ["second-new-grad-it-company-research", "second-new-grad-it-portfolio-guide", "employee-contractor-pay-comparison"]) {
      const article = await getArticle(slug);
      const placement = getContextualMobileAd(slug, article.contentHtml);
      expect(placement).not.toBeNull();
      const index = placement!.index;
      expect(index).toBeGreaterThan(article.contentHtml.length / 2);
      expect(article.contentHtml.slice(0, index) + article.contentHtml.slice(index)).toBe(article.contentHtml);
      expect(article.contentHtml.slice(index)).toMatch(/^<(h2|p)\b/);
      if (slug === "employee-contractor-pay-comparison") {
        expect(article.contentHtml.slice(0, index)).toContain("税務署や税理士");
        expect(placement!.intro).toContain("用途が異なります");
      }
    }
  });
  it("falls back for missing or duplicated anchors", () => {
    const slug = "second-new-grad-it-company-research";
    const heading = "<h2>まとめ：分からないことを残すのも企業研究</h2>";
    expect(getContextualMobileAd(slug, "<p>本文</p>")).toBeNull();
    expect(getContextualMobileAd(slug, `<p>本文</p>${heading}${heading}`)).toBeNull();
  });
  it("does not opt other articles or inherited object names in", () => {
    expect(getContextualMobileAd("unknown", "<p>本文</p>")).toBeNull();
    expect(getContextualMobileAd("toString", "<p>本文</p>")).toBeNull();
  });
});
