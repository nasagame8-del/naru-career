import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
  // クローラーは自分に一致する最も具体的なグループしか読まないため、
  // 個別に許可するbotにも非公開パスのdisallowを毎回含める。
  const privatePaths = ["/internal/", "/members/", "/api/"];
  const allowed = (userAgent: string) => ({ userAgent, allow: "/", disallow: privatePaths });

  return {
    rules: [
      { userAgent: "*", disallow: privatePaths },
      // 検索・リアルタイム引用系
      allowed("Googlebot"),
      // AdSense審査・広告配信クローラーにも公開ページへのアクセスを許可
      allowed("Mediapartners-Google"),
      allowed("Google-Display-Ads-Bot"),
      allowed("Bingbot"),
      allowed("OAI-SearchBot"),
      allowed("ChatGPT-User"),
      allowed("PerplexityBot"),
      allowed("ClaudeBot"),
      // 学習目的クローラー（デフォルトは許可、CCBotのみブロック）
      allowed("GPTBot"),
      allowed("Google-Extended"),
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
