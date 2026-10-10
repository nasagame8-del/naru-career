import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt for AdSense readiness", () => {
  it("allows AdSense crawlers to access public pages but not private routes", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    for (const userAgent of ["Mediapartners-Google", "Google-Display-Ads-Bot"]) {
      expect(rules.find((rule) => rule.userAgent === userAgent)).toEqual({
        userAgent,
        allow: "/",
        disallow: ["/internal/", "/members/", "/api/"],
      });
    }
  });

  it("keeps existing restrictions and the public sitemap", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    expect(rules.find((rule) => rule.userAgent === "CCBot")).toEqual({
      userAgent: "CCBot",
      disallow: "/",
    });
    expect(rules.find((rule) => rule.userAgent === "*")).toEqual({
      userAgent: "*",
      disallow: ["/internal/", "/members/", "/api/"],
    });
    expect(config.sitemap).toBe(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com"}/sitemap.xml`
    );
  });
});
