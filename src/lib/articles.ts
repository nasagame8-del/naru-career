import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { GLOSSARY_MATCHERS } from "./glossary-links";

const articlesDir = path.join(process.cwd(), "content", "articles");

/**
 * 記事HTML内で、用語集に対応する専門用語の「初出箇所」を <dfn> でマークアップする。
 * - schema.org の DefinedTerm マイクロデータを併用し、用語集ページの該当項目へリンクする。
 * - 既存の <a> リンク内・見出し(h1〜h6)内・HTMLタグの属性内はマッチ対象から除外する。
 * - 各用語は記事内で一度だけ（初出のみ）マークアップする。
 */
function annotateGlossaryTerms(htmlStr: string): string {
  // タグとテキストに分割（<...> をタグとして扱う）
  const tokens = htmlStr.split(/(<[^>]+>)/);
  const done = new Set<string>();
  let anchorDepth = 0;
  let headingDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("<")) {
      if (/^<a[\s>]/i.test(token)) anchorDepth++;
      else if (/^<\/a>/i.test(token)) anchorDepth = Math.max(0, anchorDepth - 1);
      else if (/^<h[1-6][\s>]/i.test(token)) headingDepth++;
      else if (/^<\/h[1-6]>/i.test(token)) headingDepth = Math.max(0, headingDepth - 1);
      continue;
    }
    // リンク内・見出し内のテキストはスキップ
    if (anchorDepth > 0 || headingDepth > 0) continue;

    let text = token;
    for (const matcher of GLOSSARY_MATCHERS) {
      if (done.has(matcher.anchor)) continue;
      for (const alias of matcher.aliases) {
        const idx = text.indexOf(alias);
        if (idx === -1) continue;
        const replacement =
          `<dfn class="glossary-term" itemscope itemtype="https://schema.org/DefinedTerm">` +
          `<a href="/glossary#${matcher.anchor}" itemprop="url">` +
          `<span itemprop="name">${alias}</span></a></dfn>`;
        text = text.slice(0, idx) + replacement + text.slice(idx + alias.length);
        done.add(matcher.anchor);
        break;
      }
    }
    tokens[i] = text;
  }

  return tokens.join("");
}

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
  summary: string[];
  resume_template: boolean;
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
    summary: data.summary ?? [],
    resume_template: data.resume_template ?? false,
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

  // 専門用語の初出箇所に <dfn>（DefinedTermマイクロデータ付き）を付与
  htmlStr = annotateGlossaryTerms(htmlStr);

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
    summary: data.summary ?? [],
    resume_template: data.resume_template ?? false,
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
