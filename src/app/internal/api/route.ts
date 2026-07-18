import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export const dynamic = "force-dynamic";

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");
  const articlesDir = path.join(process.cwd(), "content", "articles");

  // ASP status
  const aspStatus = readJson(path.join(dataDir, "asp-status.json"));

  // Articles status
  const articlesStatus = readJson(path.join(dataDir, "articles-status.json"));

  // CTA registry
  const ctaRegistry = readJson(path.join(dataDir, "cta-registry.json"));

  // Keywords
  const keywords = readCsv(path.join(dataDir, "keywords.csv"));
  const pendingKeywords = keywords.filter((k) => k.status !== "published");

  // Article counts from frontmatter
  const articleFiles = fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    : [];

  let publishedCount = 0;
  let draftCount = 0;
  const articles: { slug: string; title: string; datePublished: string; category: string }[] = [];

  for (const file of articleFiles) {
    const content = fs.readFileSync(path.join(articlesDir, file), "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.md$/, "");
    articles.push({
      slug,
      title: data.title || slug,
      datePublished: data.datePublished || "",
      category: data.category || "",
    });
    publishedCount++;
  }

  // Scheduled articles (from articles-status.json)
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scheduled = (articlesStatus?.articles || [])
    .filter((a: { scheduled_publish?: string }) => {
      if (!a.scheduled_publish) return false;
      const d = new Date(a.scheduled_publish);
      return d >= now && d <= sevenDaysLater;
    })
    .sort((a: { scheduled_publish: string }, b: { scheduled_publish: string }) =>
      a.scheduled_publish.localeCompare(b.scheduled_publish)
    );

  // Review check (inline calculation)
  const THRESHOLD_DAYS = 180;
  const reviewDue = (articlesStatus?.articles || []).filter((a: { lastReviewDate?: string; slug: string }) => {
    const baseDate = a.lastReviewDate;
    if (!baseDate) return false;
    const elapsed = Math.floor((now.getTime() - new Date(baseDate).getTime()) / (24 * 60 * 60 * 1000));
    return elapsed >= THRESHOLD_DAYS;
  });

  return NextResponse.json({
    asp: aspStatus,
    site: {
      publishedCount,
      draftCount,
      totalArticles: articleFiles.length,
      scheduled,
      reviewDue,
    },
    cta: ctaRegistry,
    keywords: pendingKeywords,
  });
}
