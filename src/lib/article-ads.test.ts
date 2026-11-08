import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ADS, getArticleAd, shouldShowMobileArticleAd } from "./article-ads";

describe("article advertising allowlist", () => {
  it("only enables reviewed, existing articles", () => {
    expect(Object.keys(ARTICLE_ADS)).toHaveLength(36);
    for (const slug of Object.keys(ARTICLE_ADS)) {
      expect(fs.existsSync(path.join(process.cwd(), "content/articles", `${slug}.md`))).toBe(true);
    }
    expect(getArticleAd("contractor-exclusivity-noncompete-checks")).toBe("anycrew");
    expect(getArticleAd("offer-letter-before-acceptance-not-provided")).toBe("kosmo");
  });
  it("avoids duplicate mobile banners on articles with existing body ads", () => {
    expect(shouldShowMobileArticleAd("how-to-resign-experience")).toBe(false);
    expect(shouldShowMobileArticleAd("retirement-agency-second-new-grad-how-to-choose")).toBe(false);
    expect(shouldShowMobileArticleAd("second-new-grad-it-interview-questions")).toBe(true);
    expect(shouldShowMobileArticleAd("unknown")).toBe(false);
  });
  it("does not place job ads on unrelated or inherited names", () => {
    for (const slug of ["contractor-unpaid-invoice", "unknown", "toString", "constructor", "__proto__"]) {
      expect(getArticleAd(slug)).toBeUndefined();
    }
  });
});
