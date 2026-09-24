/**
 * 構成 → 執筆 → 内部リンク の生成ロジック。
 *
 * 調査フェーズは実Web検索を伴うため research.ts に分離している。
 *
 * すべてLLM呼び出しを伴うが、**出力は必ず安全判定（safety.ts）を通す**。
 * ここでの責務は「生成すること」だけで、「公開してよいか」は判断しない。
 *
 * 一人称の実体験については、許可された一次情報だけをプロンプトへ与え、
 * それ以外を書かないよう明示的に禁止する。生成後も機械的に検査する。
 */

import {
  runStructured,
  obj,
  arr,
  str,
  num,
  strArr,
  enumStr,
} from "@/lib/seo-editor/openai";
import { ARTICLE_FACTORY_MODEL, ARTICLE_FACTORY_MODEL_LIGHT, LIMITS } from "./config";
import { normalizeArticleBody } from "./markdown";
import { allowedPersonaFacts, extractInternalLinkPaths } from "./safety";
import type {
  ArticleDraft,
  ArticleFrontmatter,
  ArticleOutline,
  ResearchResult,
  SelectedTopic,
} from "./types";

/** すべてのプロンプトに共通する禁止事項 */
const COMMON_RULES = `あなたは日本語メディア「NARU」（第二新卒 × IT/Web転職）の編集者兼ライターです。

## 一人称の実体験について（最重要）

著者として表明してよい一次情報は、以下が**すべて**です。

${allowedPersonaFacts()
  .map((f) => `- ${f}`)
  .join("\n")}

この範囲を超える一人称の実体験（勤務先・具体的な面接エピソード・年収の推移・
上司や同僚の描写など）を**絶対に創作しないでください**。
書けることが足りない場合は、一般論・公的データ・出典のある記述に置き換えてください。

## 出典について

- 時事性のある主張（制度・統計・年度に依存する数値）には必ず出典が必要です。
- 出典を思い出せない場合、**URLを創作してはいけません**。
  その主張は unsupportedClaims に入れてください。`;

// ── Phase: outline ──

const OUTLINE_SCHEMA = obj({
  title: str,
  targetChars: num,
  sections: arr(
    obj({
      heading: str,
      level: enumStr(["2", "3"]),
      intent: str,
      sourceUrls: strArr,
    })
  ),
});

interface RawOutline {
  title: string;
  targetChars: number;
  sections: { heading: string; level: string; intent: string; sourceUrls: string[] }[];
}

function isRawOutline(v: unknown): v is RawOutline {
  if (!v || typeof v !== "object") return false;
  return Array.isArray((v as RawOutline).sections);
}

export async function runOutline(
  topic: SelectedTopic,
  research: ResearchResult
): Promise<ArticleOutline> {
  const { data } = await runStructured<RawOutline>({
    name: "article_outline",
    instructions: `${COMMON_RULES}

## このフェーズの仕事

記事の構成（見出し）を作ってください。

- level は "2"（H2）か "3"（H3）。
- sourceUrls には、その節が依拠する出典URLを入れる。与えられた出典以外のURLを書かない。
- 検索意図に真っ直ぐ答える構成にする。前置きを長くしない。
- 「結論」という見出しは記事全体で**1回まで**。繰り返し使わない。`,
    input: [
      "<topic>",
      JSON.stringify(topic, null, 1),
      "</topic>",
      "<available_sources>",
      JSON.stringify(research.sources, null, 1),
      "</available_sources>",
    ].join("\n"),
    schema: OUTLINE_SCHEMA,
    model: ARTICLE_FACTORY_MODEL_LIGHT,
    validate: isRawOutline,
  });

  const allowedUrls = new Set(research.sources.map((s) => s.url));

  return {
    title: data.title || topic.title,
    targetChars: Number(data.targetChars) || 4000,
    sections: data.sections.map((s) => ({
      heading: s.heading,
      level: s.level === "3" ? 3 : 2,
      intent: s.intent,
      // 与えていない出典URLが紛れ込んだら落とす
      sourceUrls: (s.sourceUrls ?? []).filter((u) => allowedUrls.has(u)),
    })),
  };
}

// ── Phase: write ──

const WRITE_SCHEMA = obj({
  body: str,
  excerpt: str,
  summary: strArr,
  faq: arr(obj({ question: str, answer: str })),
  naruPoint: str,
});

interface RawWrite {
  body: string;
  excerpt: string;
  summary: string[];
  faq: { question: string; answer: string }[];
  naruPoint: string;
}

function isRawWrite(v: unknown): v is RawWrite {
  if (!v || typeof v !== "object") return false;
  const w = v as RawWrite;
  return typeof w.body === "string" && Array.isArray(w.summary) && Array.isArray(w.faq);
}

/** 今日の日付（YYYY-MM-DD） */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runWrite(
  topic: SelectedTopic,
  outline: ArticleOutline,
  research: ResearchResult
): Promise<ArticleDraft> {
  const { data } = await runStructured<RawWrite>({
    name: "article_write",
    instructions: `${COMMON_RULES}

## このフェーズの仕事

構成に沿って記事本文を書いてください。

- body は frontmatter を**含めない** Markdown 本文のみ。
- body を \`<body>\` / \`<html>\` / \`<head>\` などの文書タグやコードフェンスで囲まない。
- 見出しは ## / ### を使う。# は使わない。
- この段階では内部リンクを入れない（次のフェーズで追加する）。
- 外部リンクは与えられた出典URLのみ。それ以外のURLを書かない。
- summary は3〜5件。記事の要点を箇条書きにする。
- faq は3〜5件。question / answer とも空にしない。
- naruPoint は著者視点の一言。許可された一次情報の範囲を超えない。
  書けることが無ければ空文字にする。
- 「結論」という見出し・書き出しは記事全体で**1回まで**。`,
    input: [
      "<topic>",
      JSON.stringify(topic, null, 1),
      "</topic>",
      "<outline>",
      JSON.stringify(outline, null, 1),
      "</outline>",
      "<sources>",
      JSON.stringify(research.sources, null, 1),
      "</sources>",
      `目標文字数: ${outline.targetChars}`,
    ].join("\n"),
    schema: WRITE_SCHEMA,
    model: ARTICLE_FACTORY_MODEL,
    validate: isRawWrite,
  });

  const frontmatter: ArticleFrontmatter = {
    title: outline.title || topic.title,
    category: topic.category,
    keyword: topic.primaryKeyword,
    datePublished: today(),
    dateModified: today(),
    excerpt: data.excerpt,
    summary: data.summary,
    faq: data.faq,
    cta_agents: [],
    note_published: false,
    ...(data.naruPoint && data.naruPoint.trim() !== "" ? { naruPoint: data.naruPoint } : {}),
  };

  const body = normalizeArticleBody(data.body);

  return {
    slug: topic.slug,
    frontmatter,
    body,
    internalLinks: [],
    charCount: body.length,
  };
}

// ── Phase: internal-links ──

const LINKS_SCHEMA = obj({
  body: str,
  addedLinks: strArr,
});

interface RawLinks {
  body: string;
  addedLinks: string[];
}

function isRawLinks(v: unknown): v is RawLinks {
  if (!v || typeof v !== "object") return false;
  return typeof (v as RawLinks).body === "string";
}

/**
 * 内部リンクの追加。
 *
 * LLMには「実在するパスの一覧」だけを渡し、そこから選ばせる。
 * 生成後、実在しないリンクが混ざっていたら**機械的に取り除く**。
 */
export async function runInternalLinks(
  draft: ArticleDraft,
  knownPaths: string[]
): Promise<ArticleDraft> {
  const allowed = new Set(knownPaths);

  const { data } = await runStructured<RawLinks>({
    name: "article_internal_links",
    instructions: `${COMMON_RULES}

## このフェーズの仕事

本文に内部リンクを追加してください。

- リンク先は **与えられた既存パス一覧の中からのみ** 選ぶ。
- 一覧に無いパスを書かない。外部URLを追加しない。
- 最大 ${LIMITS.maxInternalLinks} 本まで。文脈に合う箇所にだけ入れる。
- 本文の内容は変えない。リンクの挿入のみ行う。
- 返却する body を \`<body>\` / \`<html>\` / \`<head>\` で囲まない。
- addedLinks には追加したパスを列挙する。`,
    input: [
      "<article_body>",
      draft.body,
      "</article_body>",
      "<allowed_paths>",
      JSON.stringify(knownPaths, null, 1),
      "</allowed_paths>",
    ].join("\n"),
    schema: LINKS_SCHEMA,
    model: ARTICLE_FACTORY_MODEL_LIGHT,
    validate: isRawLinks,
  });

  // 実在しない内部リンクはリンク記法を外してテキストに戻す
  let body = normalizeArticleBody(data.body || draft.body);
  const linkRe = /\[([^\]]*?)\]\((\/[^)\s]*)\)/g;
  body = body.replace(linkRe, (match, text: string, path: string) => {
    const clean = path.split(/[?#]/)[0];
    return allowed.has(clean) ? match : text;
  });

  const finalLinks = extractInternalLinkPaths(body).filter((p) => allowed.has(p));

  return {
    ...draft,
    body,
    internalLinks: finalLinks,
    charCount: body.length,
  };
}
