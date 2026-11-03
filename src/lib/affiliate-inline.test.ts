import { describe, expect, it } from "vitest";
import { renderAgentCTAComparison, renderInlineAffiliateCTA } from "./affiliate-inline";
import { getArticle, type CTAEntry } from "./articles";

const mk = (name: string, url: string): CTAEntry => ({
  name,
  url,
  cta_text: "詳細を見る",
  asp: "アクセストレード",
  affiliate: true,
});

describe("editorial CTA presentation", () => {
  it("groups the three different audiences into one clear comparison", () => {
    const registry = {
      mynavi_job20s: mk("マイナビジョブ20's", "https://partner.test/mynavi"),
      uzuz_28: mk("UZUZ 28新卒", "https://partner.test/uzuz"),
      techclips: mk("TechClips", "https://partner.test/techclips"),
    };
    const html = renderAgentCTAComparison(registry, "agent-comparison-2026");
    expect(html).toContain("2028年卒");
    expect(html).toContain("ITエンジニア");
    expect(html).toContain('data-cta-impression="true"');
    expect(html.match(/affiliate-choice__unlinked/g)).toHaveLength(3);
    expect(html.match(/class="affiliate-choice__card"/g)).toHaveLength(3);
    expect(html).not.toContain('href="https://partner.test');
    expect(html).not.toContain('contextual_cta_click');
  });

  it("excludes disabled or unsafe URLs without rendering dead buttons", () => {
    const registry = {
      mynavi_job20s: mk("MyNavi", ""),
      uzuz_28: mk("UZUZ", "javascript:alert(1)"),
      techclips: mk("TechClips", "https://partner.test/techclips"),
    };
    const html = renderAgentCTAComparison(registry, "agent-comparison-2026");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="#"');
    expect(html.match(/class="affiliate-choice__card"/g)).toHaveLength(1);
  });

  it("renders only an owner-provided complete ASP creative for an affiliate", () => {
    const approved = renderInlineAffiliateCTA(
      mk("退職代行Jobs", "https://h.accesstrade.net/sp/cc?rk=0100q25q00ovm3"),
      "retirement_jobs",
      "example"
    );
    expect(approved).toContain('data-track-placement="article_inline"');
    expect(approved).toContain("広告・PR");
    expect(approved).toContain('src="https://h.accesstrade.net/sp/rr?rk=0100q25q00ovm3"');
    expect(approved).toContain('rel="nofollow"');
    expect(approved).not.toContain('contextual_cta_click');
    expect(renderInlineAffiliateCTA(mk("Unapproved", "https://partner.test/go"), "unapproved", "example")).toBe("");
    expect(renderInlineAffiliateCTA(mk("No link", ""), "disabled", "example")).toBe("");
  });
  it("renders the existing three-button article as a single comparison section", async () => {
    const article = await getArticle("agent-comparison-2026");
    expect(article.contentHtml).toContain('class="affiliate-choice"');
    expect(article.contentHtml).toContain("何を重視するかで");
    expect(article.contentHtml.match(/affiliate-choice__unlinked/g)).toHaveLength(3);
    expect(article.contentHtml).not.toContain('href="https://h.accesstrade.net/sp/cc?rk=0100plgp00ovm3"');
    expect(article.contentHtml).not.toContain("[CTA_BUTTON:");
  });

});
