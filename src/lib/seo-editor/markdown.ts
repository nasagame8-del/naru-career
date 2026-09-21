/**
 * Markdown / frontmatter の安全な組み立てと検証。
 *
 * AIに frontmatter 全体を書かせず、編集を許す項目だけを受け取って
 * 既存のキー（faq / inlineFaq / widgets / cta_agents / updateHistory 等）は
 * コード側で保持する。
 */

import matter from "gray-matter";

export interface EditableFrontmatter {
  title: string;
  category: string;
  keyword: string;
  excerpt: string;
  summary: string[];
  faq: { question: string; answer: string }[];
}

export function todayJst(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
    .toISOString()
    .slice(0, 10);
}

export function parseArticle(raw: string): { data: Record<string, unknown>; content: string } {
  const parsed = matter(raw);
  return { data: parsed.data as Record<string, unknown>, content: parsed.content };
}

/**
 * 既存frontmatterを土台に、編集可能な項目だけを上書きする。
 * 未知のキーは必ず保持する。
 */
export function mergeFrontmatter(
  existing: Record<string, unknown> | null,
  updates: EditableFrontmatter,
  opts: { isNew: boolean }
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  const today = todayJst();

  base.title = updates.title || String(base.title ?? "");
  base.category = updates.category || String(base.category ?? "業界解説");
  base.keyword = updates.keyword || String(base.keyword ?? "");
  base.excerpt = updates.excerpt || String(base.excerpt ?? "");
  if (updates.summary.length > 0) base.summary = updates.summary;
  if (updates.faq.length > 0) base.faq = updates.faq;

  if (opts.isNew) {
    base.datePublished = base.datePublished ?? today;
    base.dateModified = today;
    base.note_published = base.note_published ?? false;
    base.cta_agents = base.cta_agents ?? [];
  } else {
    base.dateModified = today;
  }

  return base;
}

/** frontmatter + 本文を1つのMarkdownファイル文字列にする */
export function buildArticle(frontmatter: Record<string, unknown>, body: string): string {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  return matter.stringify(`\n${normalized}\n`, frontmatter);
}

/** H2見出しの一覧（テキストのみ） */
export function listH2(body: string): string[] {
  const out: string[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

/**
 * EXPAND用: 指定H2セクションの末尾（次のH2の直前）に markdown を挿入する。
 * 見出しが見つからない場合は null を返し、呼び出し側で警告する。
 */
export function insertAfterSection(
  body: string,
  afterHeading: string,
  markdown: string
): string | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const targetIdx = lines.findIndex(
    (l) => /^##\s+/.test(l) && norm(l.replace(/^##\s+/, "")) === norm(afterHeading)
  );
  if (targetIdx === -1) return null;

  let end = lines.length;
  for (let i = targetIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const inserted = markdown.replace(/\r\n/g, "\n").trim();
  return [...lines.slice(0, end), "", inserted, "", ...lines.slice(end)].join("\n");
}

/**
 * リライトで保持を宣言した一次体験が、実際に残っているかを機械的に照合する。
 * 空白差だけは許容する。
 */
export function findLostSegments(after: string, segments: string[]): string[] {
  const squash = (s: string) => s.replace(/\s+/g, "");
  const haystack = squash(after);
  return segments.filter((seg) => {
    const needle = squash(seg);
    return needle.length >= 8 && !haystack.includes(needle);
  });
}

const PLACEHOLDER_RE = /\[(CTA_BUTTON|COMPARISON_TABLE|FLOW_DIAGRAM):([\w-]+)\]/g;

/** 原文に無いプレースホルダを新しく作っていないか検証する */
export function findInventedPlaceholders(before: string | null, after: string): string[] {
  const collect = (s: string) => {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(PLACEHOLDER_RE.source, "g");
    while ((m = re.exec(s)) !== null) set.add(m[0]);
    return set;
  };
  const beforeSet = before ? collect(before) : new Set<string>();
  const afterSet = collect(after);
  return [...afterSet].filter((p) => !beforeSet.has(p));
}

/** 原文にあったプレースホルダが消えていないか検証する */
export function findDroppedPlaceholders(before: string | null, after: string): string[] {
  if (!before) return [];
  const collect = (s: string) => {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(PLACEHOLDER_RE.source, "g");
    while ((m = re.exec(s)) !== null) set.add(m[0]);
    return set;
  };
  const beforeSet = collect(before);
  const afterSet = collect(after);
  return [...beforeSet].filter((p) => !afterSet.has(p));
}

/** frontmatterとして最低限成立しているか（QAのFRONTMATTERカテゴリで使う） */
export function checkFrontmatter(raw: string): string[] {
  const issues: string[] = [];
  let data: Record<string, unknown>;
  try {
    data = matter(raw).data as Record<string, unknown>;
  } catch (e) {
    return [`frontmatterをパースできません: ${e instanceof Error ? e.message : String(e)}`];
  }
  if (!raw.startsWith("---")) issues.push("frontmatterがファイル先頭にありません");

  const required = ["title", "category", "datePublished", "excerpt"];
  for (const key of required) {
    const v = data[key];
    if (typeof v !== "string" || v.trim() === "") issues.push(`frontmatter.${key} が空です`);
  }
  const category = data.category;
  if (typeof category === "string" && !["体験談", "エージェント比較", "業界解説"].includes(category)) {
    issues.push(`frontmatter.category が不正です: ${category}`);
  }
  for (const key of ["datePublished", "dateModified"]) {
    const v = data[key];
    if (typeof v === "string" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      issues.push(`frontmatter.${key} の日付形式が不正です: ${v}`);
    }
  }
  if (data.faq !== undefined && !Array.isArray(data.faq)) issues.push("frontmatter.faq が配列ではありません");
  if (data.summary !== undefined && !Array.isArray(data.summary))
    issues.push("frontmatter.summary が配列ではありません");

  const body = matter(raw).content;
  if (/^#\s+/m.test(body)) issues.push("本文にH1(#)が含まれています（H2以下を使ってください）");
  if (/^##\s*よくある質問/m.test(body))
    issues.push("本文に「## よくある質問」があります（FAQはfrontmatterに入れてください）");

  return issues;
}

/** 本文内の内部リンク（/articles/... 以外のサイト内パスも含む） */
export function extractAllSiteLinks(body: string): { anchor: string; href: string }[] {
  const out: { anchor: string; href: string }[] = [];
  const re = /\[([^\]]*)\]\((\/[^)\s]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push({ anchor: m[1], href: m[2] });
  return out;
}

/** 連続する重複段落（AIが同じ内容を繰り返す事故）を検出する */
export function findDuplicateParagraphs(body: string): string[] {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40 && !p.startsWith("#") && !p.startsWith("|"));
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const p of paragraphs) {
    const key = p.replace(/\s+/g, "");
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) dupes.push(p.slice(0, 60));
  }
  return dupes;
}
