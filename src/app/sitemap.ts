import type { MetadataRoute } from "next";
import { getAllArticleMetas } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";
import { ALL_SLUGS as TYPE_SLUGS } from "@/app/shindan/_lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
  const articles = getAllArticleMetas();
  const today = new Date().toISOString().split("T")[0];

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: article.dateModified || article.datePublished,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // カテゴリの更新日は、そのカテゴリに属する記事の最新更新日
  const categoryEntries: MetadataRoute.Sitemap = Object.entries(CATEGORIES).map(
    ([slug, cat]) => {
      const latest = articles
        .filter((a) => a.categories.includes(cat.name))
        .map((a) => a.dateModified || a.datePublished)
        .sort()
        .at(-1);
      return {
        url: `${baseUrl}/category/${slug}`,
        lastModified: latest ?? today,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    }
  );

  const typeEntries: MetadataRoute.Sitemap = TYPE_SLUGS.map((slug) => ({
    url: `${baseUrl}/types/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    {
      url: baseUrl,
      lastModified: today,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/glossary`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/shindan`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/agent-diagnosis`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: today,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/ai-interview-check`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/guides/second-new-grad-complete-guide`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...categoryEntries,
    ...typeEntries,
    ...articleEntries,
  ];
}
