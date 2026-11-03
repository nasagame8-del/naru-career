import { describe, expect, it } from "vitest";
import { renderAgentCTAComparison, renderInlineAffiliateCTA } from "./affiliate-inline";
import type { CTAEntry } from "./articles";

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
    expect(html).toContain("広告・PR");
    expect(html).toContain('data-cta-impression="true"');
    expect(html.match(/data-track-placement="article_inline_comparison"/g)).toHaveLength(3);
    expect(html.match(/class="affiliate-choice__card"/g)).toHaveLength(3);
    expect(html.match(/rel="noopener noreferrer nofollow sponsored"/g)).toHaveLength(3);
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

  it("gives a specific next step and preserves disclosed links", () => {
    const html = renderInlineAffiliateCTA(mk('相談 "サービス"', "https://partner.test/go"), "my-service", "example");
    expect(html).toContain("対象条件を確認する");
    expect(html).toContain('data-track-placement="article_inline"');
    expect(html).toContain("広告・PR");
    expect(html).toContain("noopener noreferrer nofollow sponsored");
    expect(html).toContain("相談 &quot;サービス&quot;のご案内");
    expect(renderInlineAffiliateCTA(mk("No link", ""), "disabled", "example")).toBe("");
  });
});
