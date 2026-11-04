import type { MetadataRoute } from "next";
import { getAllArticleMetas } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
  const articles = getAllArticleMetas();
  const latestContentUpdate = articles
    .map((article) => article.dateModified || article.datePublished)
    .sort()
    .at(-1);

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: article.dateModified || article.datePublished,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = Object.entries(CATEGORIES).map(
    ([slug, cat]) => {
      const latest = articles
        .filter((a) => a.categories.includes(cat.name))
        .map((a) => a.dateModified || a.datePublished)
        .sort()
        .at(-1);
      return {
        url: `${baseUrl}/category/${slug}`,
        ...(latest ? { lastModified: latest } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    }
  );

  return [
    {
      url: baseUrl,
      ...(latestContentUpdate ? { lastModified: latestContentUpdate } : {}),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/articles`,
      ...(latestContentUpdate ? { lastModified: latestContentUpdate } : {}),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/glossary`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/agent-diagnosis`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/ai-interview-check`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/guides/second-new-grad-complete-guide`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...categoryEntries,
    ...articleEntries,
  ];
}
