import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const articlesDir = path.join(process.cwd(), "content", "articles");

export type FAQ = {
  question: string;
  answer: string;
};

export type ArticleMeta = {
  slug: string;
  title: string;
  category: "体験談" | "エージェント比較" | "業界解説";
  keyword: string;
  datePublished: string;
  dateModified: string;
  excerpt: string;
  faq: FAQ[];
  cta_agents: string[];
  note_published: boolean;
  hasCardImage: boolean;
  hasHeroImage: boolean;
};

export type Heading = {
  id: string;
  text: string;
};

export type Article = ArticleMeta & {
  contentHtml: string;
  headings: Heading[];
};

export function getArticleSlugs(): string[] {
  if (!fs.existsSync(articlesDir)) return [];
  return fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getArticleMeta(slug: string): ArticleMeta {
  const filePath = path.join(articlesDir, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(fileContent);
  return {
    slug,
    title: data.title ?? "",
    category: data.category ?? "業界解説",
    keyword: data.keyword ?? "",
    datePublished: data.datePublished ?? "",
    dateModified: data.dateModified ?? "",
    excerpt: data.excerpt ?? "",
    faq: data.faq ?? [],
    cta_agents: data.cta_agents ?? [],
    note_published: data.note_published ?? false,
    hasCardImage: fs.existsSync(
      path.join(process.cwd(), "public", "images", "articles", `${slug}-card.png`)
    ),
    hasHeroImage: fs.existsSync(
      path.join(process.cwd(), "public", "images", "articles", `${slug}-hero.png`)
    ),
  };
}

export async function getArticle(slug: string): Promise<Article> {
  const filePath = path.join(articlesDir, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  // Process CTA placeholders before markdown rendering
  const ctaRegistry = getCTARegistry();
  let processedContent = content.replace(
    /\[CTA_BUTTON:(\w+)\]/g,
    (_match, key: string) => {
      const cta = ctaRegistry[key];
      if (!cta) return "";
      const href = cta.url || "#";
      const relAttr = cta.affiliate === false ? "nofollow" : "nofollow sponsored";
      const noteText = cta.affiliate === false ? "" : `<span class="cta-note">※提携先のサービスです</span>`;
      return `<a href="${href}" class="cta-button" rel="${relAttr}" target="_blank">${cta.cta_text}（${cta.name}）</a>${noteText}`;
    }
  );

  // Process EXPERIENCE placeholders
  processedContent = processedContent.replace(
    /\[EXPERIENCE:\s*(.*?)\]/g,
    (_match, placeholder: string) => {
      return `<div class="experience-box"><p><strong>💡 体験談</strong></p><p>${placeholder}</p></div>`;
    }
  );

  // Markdown本文からFAQセクションを除外（FAQSectionコンポーネントで別途表示するため）
  processedContent = processedContent.replace(
    /##\s*よくある質問[\s\S]*$/,
    ""
  );

  // ==テキスト== → <mark>テキスト</mark> (蛍光ペン風ハイライト)
  processedContent = processedContent.replace(
    /==(.*?)==/g,
    (_match, text: string) => `<mark>${text}</mark>`
  );

  const result = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(html, { sanitize: false })
    .process(processedContent);

  // h2見出しを抽出し、IDを付与
  let htmlStr = result.toString();
  const headings: Heading[] = [];
  let headingIndex = 0;
  htmlStr = htmlStr.replace(/<h2>(.*?)<\/h2>/g, (_match, text: string) => {
    const id = `section-${headingIndex++}`;
    headings.push({ id, text });
    return `<h2 id="${id}">${text}</h2>`;
  });

  return {
    slug,
    title: data.title ?? "",
    category: data.category ?? "業界解説",
    keyword: data.keyword ?? "",
    datePublished: data.datePublished ?? "",
    dateModified: data.dateModified ?? "",
    excerpt: data.excerpt ?? "",
    faq: data.faq ?? [],
    cta_agents: data.cta_agents ?? [],
    note_published: data.note_published ?? false,
    hasCardImage: fs.existsSync(
      path.join(process.cwd(), "public", "images", "articles", `${slug}-card.png`)
    ),
    hasHeroImage: fs.existsSync(
      path.join(process.cwd(), "public", "images", "articles", `${slug}-hero.png`)
    ),
    headings,
    contentHtml: htmlStr,
  };
}

export function getAllArticleMetas(): ArticleMeta[] {
  return getArticleSlugs()
    .map(getArticleMeta)
    .sort(
      (a, b) =>
        new Date(b.datePublished).getTime() -
        new Date(a.datePublished).getTime()
    );
}

export type CTAEntry = {
  name: string;
  url: string;
  cta_text: string;
  asp: string;
  affiliate?: boolean;
};

export function getCTARegistry(): Record<string, CTAEntry> {
  const registryPath = path.join(process.cwd(), "data", "cta-registry.json");
  if (!fs.existsSync(registryPath)) return {};
  return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
}
