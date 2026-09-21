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

export type Eol = "\r\n" | "\n";

/**
 * 元ファイルの改行コードを判定する。
 * content/articles は CRLF のため、LFへ正規化して書き戻すと
 * 全行が変更扱いになりPRの差分が読めなくなる。
 */
export function detectEol(raw: string | null | undefined): Eol {
  return raw && raw.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * frontmatter + 本文を1つのMarkdownファイル文字列にする。
 * @param eol 元ファイルの改行コード。既存記事の更新では必ず元の値を渡すこと
 */
export function buildArticle(
  frontmatter: Record<string, unknown>,
  body: string,
  eol: Eol = "\n"
): string {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const out = matter.stringify(`\n${normalized}\n`, frontmatter);
  // matter.stringify はLFで出力するため、元がCRLFなら復元する
  return eol === "\r\n" ? out.replace(/\r?\n/g, "\r\n") : out;
}

// ──────────────────────────────────────────
// frontmatter を「文字列として」保持する組み立て
//
// YAMLをparseして再serializeすると、キー順・クォート・空行・配列表現・
// 日付表記が変わり、本文1行の変更でもfrontmatter全体が差分になる。
// 変更が必要なキーだけを原文テキスト上で置換し、それ以外は1バイトも触らない。
// ──────────────────────────────────────────

const FRONTMATTER_RE = /^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)/;

function normalizeValue(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x instanceof Date ? x.toISOString().slice(0, 10) : x
  ) ?? "null";
}

/** 単一キーのYAML断片を得る（gray-matterのserializerをそのまま使う） */
function yamlForKey(key: string, value: unknown): string {
  const doc = matter.stringify("", { [key]: value });
  const m = doc.match(FRONTMATTER_RE);
  if (!m) return `${key}: ${JSON.stringify(value)}`;
  return m[2].replace(/\r?\n$/, "");
}

/** frontmatter本体テキストから、あるトップレベルキーが占める行範囲を求める */
function keyRange(lines: string[], key: string): { start: number; end: number } | null {
  const head = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  const start = lines.findIndex((l) => head.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    // 次のトップレベルキー（インデントなし）で終わり
    if (/^[^\s#-]/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

export interface RebuiltArticle {
  text: string;
  /** 実際に書き換えたfrontmatterのキー。空なら差分0 */
  frontmatterChangedKeys: string[];
}

/**
 * 記事ファイルを組み立てる。
 *
 * - originalRaw があれば、frontmatterは原文テキストを保持し、
 *   値が実際に変わるキーだけを行単位で置換する。
 * - originalRaw が null（新規作成）のときだけ、全体をserializeする。
 *
 * @param frontmatterUpdates 変更したいキーのみ。本文だけ変えるRunでは空オブジェクト
 */
export function rebuildArticle(opts: {
  originalRaw: string | null;
  frontmatterUpdates: Record<string, unknown>;
  body: string;
  /** originalRaw が null のときに使う改行コード */
  fallbackEol?: Eol;
}): RebuiltArticle {
  const { originalRaw, frontmatterUpdates, body } = opts;

  if (originalRaw === null) {
    const eol = opts.fallbackEol ?? "\n";
    return {
      text: buildArticle(frontmatterUpdates, body, eol),
      frontmatterChangedKeys: Object.keys(frontmatterUpdates),
    };
  }

  const eol = detectEol(originalRaw);
  const match = originalRaw.match(FRONTMATTER_RE);
  if (!match) {
    // frontmatterが無い・壊れている場合は従来どおり組み立て直す
    return {
      text: buildArticle(frontmatterUpdates, body, eol),
      frontmatterChangedKeys: Object.keys(frontmatterUpdates),
    };
  }

  const [, open, fmText, close] = match;
  const current = matter(originalRaw).data as Record<string, unknown>;

  let lines = fmText.split(/\r?\n/);
  const changedKeys: string[] = [];

  for (const [key, value] of Object.entries(frontmatterUpdates)) {
    if (normalizeValue(current[key]) === normalizeValue(value)) continue;
    changedKeys.push(key);
    const fragment = yamlForKey(key, value).split("\n");
    const range = keyRange(lines, key);
    if (range) {
      lines = [...lines.slice(0, range.start), ...fragment, ...lines.slice(range.end)];
    } else {
      lines = [...lines, ...fragment];
    }
  }

  const newFm = lines.join(eol);
  const normalizedBody = body.replace(/\r\n/g, "\n").trim().replace(/\n/g, eol);
  const text = `${open}${newFm}${close}${eol}${normalizedBody}${eol}`;

  return { text, frontmatterChangedKeys: changedKeys };
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
  // 本文末尾の「## よくある質問」は既存記事の慣習。
  // src/lib/articles.ts のレンダリング時に除去されるため、問題として扱わない。

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
