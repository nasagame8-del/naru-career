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

/** HTML断片からタグを除き、主要な文字参照を戻す（目次などプレーンテキスト表示用） */
export function htmlToPlainText(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * CommonMarkは「**」の直前・直後が日本語の括弧や句読点だと太字として扱わない。
 * 1行内で対になっている ** は先に <strong> へ置き換えておく。
 */
export function convertBoldMarkers(markdown: string): string {
  return markdown.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * 記事本文Markdownを、本番と同じ設定でHTMLへ変換する。
 * プレースホルダ変換の結果が実際にどうレンダリングされるかをテストから確認できるよう、
 * `getArticle` と同じ経路をここに切り出している。
 */
export async function renderArticleMarkdown(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(html, { sanitize: false })
    .process(markdown);
  return result.toString();
}

/** ラベルは本文の一部ではなく属性値に近いので、タグとして解釈されないようにする */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 記事本文のラベル付き囲みボックス記法を、`.naru-box` のHTMLへ変換する。
 *
 *   :::box 選考前に確認すること
 *   - 項目1
 *   - 項目2
 *   :::
 *
 * ラベルは省略できる（`:::box` だけの行）。
 *
 * 開きタグと中身の間に空行を入れるのは、CommonMarkのHTMLブロックが空行で終わり、
 * 続く箇条書き・段落が通常のMarkdownとして解釈されるようにするため。
 * これでラベル・本文・箇条書きのいずれも既存の変換（太字・リンク・用語集）を通る。
 * 入れ子は扱わない。
 */
export function convertLabeledBoxes(markdown: string): string {
  return markdown.replace(
    /^:::box[^\S\r\n]*([^\r\n]*?)[^\S\r\n]*\r?\n([\s\S]*?)^:::[^\S\r\n]*\r?$/gm,
    (_match, label: string, body: string) => {
      const trimmedLabel = label.trim();
      const labelHtml = trimmedLabel
        ? `<p class="naru-box-label">${escapeHtml(trimmedLabel)}</p>\n\n`
        : "";
      return `<div class="naru-box">\n\n${labelHtml}${body.trim()}\n\n</div>`;
    }
  );
}

/**
 * 本文の「## よくある質問」セクションだけを取り除く（FAQSectionで別途表示するため）。
 * 次のH2以降の本文は残す。
 */
export function removeFaqSection(markdown: string): string {
  return markdown.replace(/^##[ \t]*よくある質問[^\n]*\n[\s\S]*?(?=^##[ \t]|(?![\s\S]))/m, "");
}

export type FAQ = {
  question: string;
  answer: string;
};

export type InlineFAQ = {
  heading: string;
  question: string;
  answer: string;
};

export type ArticleCategory = "体験談" | "エージェント比較" | "業界解説" | "独自調査" | "雑記";

/** 主カテゴリに、frontmatter.subCategories（追加で掲載するカテゴリ）を重複なしで足す */
function resolveCategories(
  category: ArticleCategory,
  subCategories: unknown
): ArticleCategory[] {
  const extra = Array.isArray(subCategories)
    ? subCategories.filter((c): c is ArticleCategory => typeof c === "string")
    : [];
  return [...new Set([category, ...extra])];
}

export type ArticleMeta = {
  slug: string;
  title: string;
  category: ArticleCategory;
  /** 主カテゴリ＋frontmatter.subCategories。カテゴリ一覧・絞り込みはこちらで判定する */
  categories: ArticleCategory[];
  keyword: string;
  datePublished: string;
  dateModified: string;
  excerpt: string;
  faq: FAQ[];
  cta_agents: string[];
  note_published: boolean;
  summary: string[];
  naruPoint: string;
  inlineFaq: InlineFAQ[];
  updateHistory: { date: string; description: string }[];
  resume_template: boolean;
  ctaFocus: string;
  hasCardImage: boolean;
  hasHeroImage: boolean;
  cardImagePath: string | null;
  heroImagePath: string | null;
};

export type Heading = {
  id: string;
  text: string;
};

export type Article = ArticleMeta & {
  contentHtml: string;
  headings: Heading[];
};

/** 公開日が今日以前かどうか判定（日本時間基準） */
function isPublished(datePublished: string): boolean {
  // Preview deployments must expose scheduled articles for review before publication.
  if (process.env.VERCEL_ENV === "preview") return true;
  if (!datePublished) return true; // 日付なしは公開扱い
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  ).toISOString().slice(0, 10);
  return datePublished <= today;
}

/** 全slugを返す（未来日を含む。generateStaticParams・内部処理用） */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(articlesDir)) return [];
  return fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** 公開済みの記事slugのみ返す */
export function getArticleSlugs(): string[] {
  return getAllSlugs().filter((slug) => {
    const filePath = path.join(articlesDir, `${slug}.md`);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(fileContent);
    return isPublished(data.datePublished ?? "");
  });
}

/** 新規WebPを優先しつつ、既存PNGとの互換性を保つ。 */
export function getArticleImagePath(
  slug: string,
  kind: "card" | "hero"
): string | null {
  for (const extension of ["webp", "png"]) {
    const publicPath = `/images/articles/${slug}-${kind}.${extension}`;
    if (fs.existsSync(path.join(process.cwd(), "public", publicPath))) {
      return publicPath;
    }
  }
  return null;
}

export function getArticleMeta(slug: string): ArticleMeta {
  const filePath = path.join(articlesDir, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(fileContent);
  const cardImagePath = getArticleImagePath(slug, "card");
  const heroImagePath = getArticleImagePath(slug, "hero");
  return {
    slug,
    title: data.title ?? "",
    category: data.category ?? "業界解説",
    categories: resolveCategories(data.category ?? "業界解説", data.subCategories),
    keyword: data.keyword ?? "",
    datePublished: data.datePublished ?? "",
    dateModified: data.dateModified ?? "",
    excerpt: data.excerpt ?? "",
    faq: data.faq ?? [],
    cta_agents: data.cta_agents ?? [],
    note_published: data.note_published ?? false,
    summary: data.summary ?? [],
    naruPoint: data.naruPoint ?? "",
    inlineFaq: data.inlineFaq ?? [],
    updateHistory: data.updateHistory ?? [],
    resume_template: data.resume_template ?? false,
    ctaFocus: data.ctaFocus ?? "",
    hasCardImage: cardImagePath !== null,
    hasHeroImage: heroImagePath !== null,
    cardImagePath,
    heroImagePath,
  };
}

export async function getArticle(slug: string): Promise<Article> {
  const filePath = path.join(articlesDir, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  // Process CTA placeholders before markdown rendering
  const ctaRegistry = getCTARegistry();
  let processedContent = convertBoldMarkers(convertLabeledBoxes(content)).replace(
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

  // Process widget placeholders (comparison tables, flow diagrams)
  processedContent = processedContent.replace(
    /\[COMPARISON_TABLE:([\w-]+)\]/g,
    (_match, id: string) => `<div data-widget="comparison-table" data-widget-id="${id}"></div>`
  );
  processedContent = processedContent.replace(
    /\[FLOW_DIAGRAM:([\w-]+)\]/g,
    (_match, id: string) => `<div data-widget="flow-diagram" data-widget-id="${id}"></div>`
  );

  // Process EXPERIENCE placeholders
  processedContent = processedContent.replace(
    /\[EXPERIENCE:\s*(.*?)\]/g,
    (_match, placeholder: string) => {
      return `<div class="experience-box"><p><strong>💡 体験談</strong></p><p>${placeholder}</p></div>`;
    }
  );

  processedContent = removeFaqSection(processedContent);

  // ==テキスト== → <mark>テキスト</mark> (蛍光ペン風ハイライト)
  processedContent = processedContent.replace(
    /==([^=\n]+?)==/g,
    (_match, text: string) => `<mark>${text}</mark>`
  );

  // h2見出しを抽出し、IDを付与
  let htmlStr = await renderArticleMarkdown(processedContent);
  const headings: Heading[] = [];
  let headingIndex = 0;
  htmlStr = htmlStr.replace(/<h2>(.*?)<\/h2>/g, (_match, inner: string) => {
    const id = `section-${headingIndex++}`;
    headings.push({ id, text: htmlToPlainText(inner) });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  // InlineFAQ: 見出しテキストを含むH2の直後に一問一答を挿入する。
  // 挿入できたものだけを返し、画面に無いFAQを構造化データへ出さない。
  const inlineFaqs: InlineFAQ[] = data.inlineFaq ?? [];
  const placedInlineFaqs: InlineFAQ[] = [];
  for (const ifaq of inlineFaqs) {
    let placed = false;
    htmlStr = htmlStr.replace(/<h2 id="[^"]*">.*?<\/h2>/g, (h2) => {
      if (placed || !htmlToPlainText(h2).includes(ifaq.heading)) return h2;
      placed = true;
      return `${h2}<div class="inline-faq"><p class="inline-faq-q"><strong>Q. ${ifaq.question}</strong></p><p class="inline-faq-a">${ifaq.answer}</p></div>`;
    });
    if (placed) placedInlineFaqs.push(ifaq);
  }

  // 対になっていない ** が残っても画面に露出させない
  htmlStr = htmlStr.replace(/\*\*/g, "");

  // 表はスマホで横スクロールできるようにラップする
  htmlStr = htmlStr
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, "</table></div>");

  // 本文画像は遅延読み込み
  htmlStr = htmlStr.replace(/<img (?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async" ');

  // 専門用語の初出箇所に <dfn>（DefinedTermマイクロデータ付き）を付与
  htmlStr = annotateGlossaryTerms(htmlStr);

  const cardImagePath = getArticleImagePath(slug, "card");
  const heroImagePath = getArticleImagePath(slug, "hero");
  return {
    slug,
    title: data.title ?? "",
    category: data.category ?? "業界解説",
    categories: resolveCategories(data.category ?? "業界解説", data.subCategories),
    keyword: data.keyword ?? "",
    datePublished: data.datePublished ?? "",
    dateModified: data.dateModified ?? "",
    excerpt: data.excerpt ?? "",
    faq: data.faq ?? [],
    cta_agents: data.cta_agents ?? [],
    note_published: data.note_published ?? false,
    summary: data.summary ?? [],
    naruPoint: data.naruPoint ?? "",
    inlineFaq: placedInlineFaqs,
    updateHistory: data.updateHistory ?? [],
    resume_template: data.resume_template ?? false,
    ctaFocus: data.ctaFocus ?? "",
    hasCardImage: cardImagePath !== null,
    hasHeroImage: heroImagePath !== null,
    cardImagePath,
    heroImagePath,
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
