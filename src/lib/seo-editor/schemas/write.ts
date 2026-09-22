/** PHASE 7 — 新規記事生成 / リライトの JSON Schema */

import { obj, arr, str, strArr, enumStr, nullableStr } from "../openai";

const faq = obj({ question: str, answer: str });

/**
 * frontmatter は編集を許す項目だけを受け取る。
 * faq / inlineFaq / widgets / cta_agents など既存のキーは
 * コード側でマージして保持する（AIに落とさせない）。
 */
const frontmatter = obj({
  title: str,
  category: enumStr(["体験談", "エージェント比較", "業界解説"]),
  keyword: str,
  excerpt: str,
  summary: strArr,
  faq: arr(faq),
});

const insertion = obj({
  /** 挿入位置の直前にあるH2見出しテキスト。EXPAND専用 */
  afterHeading: str,
  markdown: str,
});

export const WRITE_SCHEMA = obj({
  operation: enumStr(["CREATE", "REWRITE", "EXPAND", "MERGE"]),
  slug: str,
  frontmatter,
  /** CREATE / REWRITE / MERGE: frontmatterを除いた本文全体。EXPANDでは空文字 */
  markdownBody: str,
  /** EXPAND専用。CREATE/REWRITE/MERGEでは空配列 */
  insertions: arr(insertion),
  /** 原文から一字一句変えずに残した一次体験の断片（検証に使う） */
  preservedSegments: strArr,
  changeNotes: strArr,
  /** MERGE時の統合元slug。他は null */
  mergeSecondarySlug: nullableStr(),
});
