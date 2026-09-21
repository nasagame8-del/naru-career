/**
 * 記事コーパス。
 *
 * コスト対策の中核:
 *   全記事metadata → 関連候補抽出 → 必要記事のみ本文取得 → LLM
 * という順序を強制するため、metadata索引と本文取得を分離している。
 * 本文はモジュールスコープのキャッシュに載るため、同一Run内で
 * 同じ記事を何度も読み直さない。
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "./config";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");
const PROMPTS_DIR = path.join(process.cwd(), "prompts");

export interface ArticleIndexEntry {
  slug: string;
  path: string;
  url: string;
  title: string;
  /** frontmatter の excerpt。meta description 相当 */
  description: string;
  category: string;
  keyword: string;
  publishedAt: string;
  updatedAt: string;
  /** H2（一部H3）見出しテキスト */
  headings: string[];
  summary: string[];
  /** この記事から出ている内部リンク先slug */
  internalLinksOut: string[];
  /** この記事へ入ってきている内部リンク元slug */
  internalLinksIn: string[];
  charCount: number;
}

/** Markdown本文から見出しを抽出 */
function extractHeadings(body: string): string[] {
  const out: string[] = [];
  const re = /^(#{2,3})\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push(`${m[1] === "##" ? "H2" : "H3"}: ${m[2]}`);
  }
  return out;
}

/** 本文中の /articles/<slug> リンクを抽出（既存Dashboardと同じ正規表現） */
export function extractInternalLinks(body: string, selfSlug?: string): string[] {
  const out: string[] = [];
  const re = /\[.*?\]\(\/articles\/([\w-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1] !== selfSlug) out.push(m[1]);
  }
  return [...new Set(out)];
}

const bodyCache = new Map<string, string>();
let indexCache: ArticleIndexEntry[] | null = null;

function listArticleFiles(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .sort();
}

/** 記事本文（frontmatter込みの生Markdown）を取得。同一プロセス内でキャッシュ */
export function getRawArticle(slug: string): string | null {
  const cached = bodyCache.get(slug);
  if (cached !== undefined) return cached;
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  bodyCache.set(slug, raw);
  return raw;
}

/** 指定slugの本文をまとめて取得（存在しないものは除外） */
export function getRawArticles(slugs: string[]): { slug: string; raw: string }[] {
  const out: { slug: string; raw: string }[] = [];
  for (const slug of [...new Set(slugs)]) {
    const raw = getRawArticle(slug);
    if (raw) out.push({ slug, raw });
  }
  return out;
}

/** metadata索引を構築。本文はプロンプトへ載せない */
export function getArticleIndex(): ArticleIndexEntry[] {
  if (indexCache) return indexCache;

  const files = listArticleFiles();
  const entries: Omit<ArticleIndexEntry, "internalLinksIn">[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = getRawArticle(slug);
    if (!raw) continue;
    const { data, content } = matter(raw);
    entries.push({
      slug,
      path: `content/articles/${file}`,
      url: `${SITE_URL}/articles/${slug}`,
      title: String(data.title ?? slug),
      description: String(data.excerpt ?? ""),
      category: String(data.category ?? ""),
      keyword: String(data.keyword ?? ""),
      publishedAt: String(data.datePublished ?? ""),
      updatedAt: String(data.dateModified ?? data.datePublished ?? ""),
      headings: extractHeadings(content),
      summary: Array.isArray(data.summary) ? data.summary.map(String) : [],
      internalLinksOut: extractInternalLinks(content, slug),
      charCount: content.length,
    });
  }

  const incoming = new Map<string, string[]>();
  for (const e of entries) {
    for (const target of e.internalLinksOut) {
      const list = incoming.get(target) ?? [];
      list.push(e.slug);
      incoming.set(target, list);
    }
  }

  indexCache = entries.map((e) => ({ ...e, internalLinksIn: incoming.get(e.slug) ?? [] }));
  return indexCache;
}

export function getIndexEntry(slug: string): ArticleIndexEntry | null {
  return getArticleIndex().find((e) => e.slug === slug) ?? null;
}

/**
 * ピラーとして扱うガイドページ。
 * content/guides は存在せず、TSXでハードコードされているため
 * 変更対象ではなく「内部リンク先・Pillar参照」としてのみ扱う。
 */
export const GUIDE_PAGES = [
  {
    url: `${SITE_URL}/guides/second-new-grad-complete-guide`,
    pathname: "/guides/second-new-grad-complete-guide",
    title: "第二新卒×IT/Web転職 完全ガイド",
    editable: false,
    note: "src/app/guides/ 配下のTSXページ。SEO EditorはMarkdown変更対象にしない",
  },
] as const;

/** 内部リンク先として実在すると保証できるパスの集合 */
export function getKnownPathnames(): Set<string> {
  const paths = new Set<string>([
    "/",
    "/about",
    "/glossary",
    "/shindan",
    "/agent-diagnosis",
    "/ai-interview-check",
    "/contact",
    "/privacy",
  ]);
  for (const g of GUIDE_PAGES) paths.add(g.pathname);
  for (const slug of Object.keys(CATEGORIES)) paths.add(`/category/${slug}`);
  for (const e of getArticleIndex()) paths.add(`/articles/${e.slug}`);
  return paths;
}

/** URL・パスいずれの表記でも受け取り、サイト内パスに正規化する */
export function toPathname(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("/")) return urlOrPath.split(/[?#]/)[0];
  try {
    const u = new URL(urlOrPath);
    if (!u.hostname.endsWith("naru-career.com")) return null;
    return u.pathname;
  } catch {
    return null;
  }
}

/** Search Console の page URL から記事slugを取り出す */
export function urlToSlug(urlOrPath: string): string | null {
  const pathname = toPathname(urlOrPath);
  if (!pathname) return null;
  const m = pathname.match(/^\/articles\/([\w-]+)\/?$/);
  return m ? m[1] : null;
}

// ── 一次情報（実体験の正本） ──

let experienceCache: string | null = null;
let personaCache: string | null = null;

/** prompts/experience-notes.md — 本人情報の正本 */
export function getExperienceNotes(): string {
  if (experienceCache !== null) return experienceCache;
  const p = path.join(PROMPTS_DIR, "experience-notes.md");
  experienceCache = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
  return experienceCache;
}

/** prompts/persona.md — 文体・著者性 */
export function getPersona(): string {
  if (personaCache !== null) return personaCache;
  const p = path.join(PROMPTS_DIR, "persona.md");
  personaCache = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
  return personaCache;
}

/**
 * 索引に載せる最小限の形（プロンプト投入用）。
 *
 * headings は全記事分を載せるとトークンが大きく増えるため、
 * placement の指定に見出しが要る Phase（3・5）でのみ含める。
 */
export function compactIndex(entries: ArticleIndexEntry[], withHeadings = true) {
  return entries.map((e) => ({
    slug: e.slug,
    title: e.title,
    category: e.category,
    keyword: e.keyword,
    description: e.description,
    ...(withHeadings ? { headings: e.headings } : {}),
    summary: e.summary,
    publishedAt: e.publishedAt,
    updatedAt: e.updatedAt,
    linksOut: e.internalLinksOut,
    linksIn: e.internalLinksIn,
  }));
}

/** テスト・再実行時にキャッシュを落とす */
export function resetCorpusCache(): void {
  bodyCache.clear();
  indexCache = null;
  experienceCache = null;
  personaCache = null;
}
