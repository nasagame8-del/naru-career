/**
 * Phase 間で共有する入力組み立てと候補抽出。
 *
 * ここでのコード側の絞り込みが、全記事本文をLLMへ送らないための要。
 */

import { LIMITS } from "../config";
import {
  compactIndex,
  getArticleIndex,
  getIndexEntry,
  getRawArticles,
  GUIDE_PAGES,
  type ArticleIndexEntry,
} from "../corpus";
import { asJsonBlock, truncate, wrapUntrusted } from "../sanitize";
import type { GscSnapshot } from "../gsc-input";
import type { SeoTopicCandidate } from "@/types/seo-editor";

/** テーマ文字列・クエリから記事候補をスコアリングする（LLMを使わない） */
export function scoreRelevance(entry: ArticleIndexEntry, terms: string[]): number {
  const haystacks: [string, number][] = [
    [entry.title, 5],
    [entry.keyword, 5],
    [entry.description, 2],
    [entry.headings.join(" "), 2],
    [entry.summary.join(" "), 1],
    [entry.slug.replace(/-/g, " "), 3],
  ];
  let score = 0;
  for (const term of terms) {
    const t = term.trim().toLowerCase();
    if (t.length < 2) continue;
    for (const [text, weight] of haystacks) {
      if (text.toLowerCase().includes(t)) score += weight;
    }
  }
  return score;
}

/** 選択テーマに関連する語を取り出す（クエリ＋テーマ名の分かち） */
export function topicTerms(topic: SeoTopicCandidate): string[] {
  const terms = new Set<string>();
  terms.add(topic.topic);
  for (const part of topic.topic.split(/[\s　×/・,、]+/)) {
    if (part.length >= 2) terms.add(part);
  }
  for (const q of topic.queries) {
    terms.add(q.query);
    for (const part of q.query.split(/[\s　]+/)) {
      if (part.length >= 2) terms.add(part);
    }
  }
  return [...terms];
}

export interface RelatedArticles {
  /** 関連度順のslug */
  slugs: string[];
  entries: ArticleIndexEntry[];
  /** Search Console 上でそのテーマのクエリが当たっているslug */
  gscSlugs: string[];
}

/**
 * 選択テーマの関連記事を抽出する。
 * Search Console の page×query を最優先し、足りない分をメタデータ一致で補う。
 */
export function selectRelatedArticles(
  topic: SeoTopicCandidate,
  snapshot: GscSnapshot,
  max: number
): RelatedArticles {
  const index = getArticleIndex();
  const wantedQueries = new Set(topic.queries.map((q) => q.query.toLowerCase()));

  const gscSlugs = new Set<string>();
  for (const q of snapshot.queries) {
    if (!wantedQueries.has(q.query.toLowerCase())) continue;
    for (const p of q.pages) if (p.slug) gscSlugs.add(p.slug);
  }
  for (const p of snapshot.pages) {
    if (!p.slug) continue;
    if (p.queries.some((pq) => wantedQueries.has(pq.query.toLowerCase()))) gscSlugs.add(p.slug);
  }
  // topic.relatedPages はPhase 1の出力。実在するslugだけ採用する
  for (const url of topic.relatedPages) {
    const m = url.match(/\/articles\/([\w-]+)/);
    if (m && getIndexEntry(m[1])) gscSlugs.add(m[1]);
  }

  const terms = topicTerms(topic);
  const scored = index
    .map((e) => ({ e, score: scoreRelevance(e, terms) + (gscSlugs.has(e.slug) ? 20 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  return {
    slugs: scored.map((x) => x.e.slug),
    entries: scored.map((x) => x.e),
    gscSlugs: [...gscSlugs],
  };
}

/** 本文をプロンプトへ載せる形に整える（件数・文字数を必ず制限する） */
export function bodiesBlock(slugs: string[], maxCount = LIMITS.maxBodiesForCannibalization): {
  block: string;
  inspected: string[];
} {
  const picked = slugs.slice(0, maxCount);
  const raws = getRawArticles(picked);
  const parts = raws.map(
    ({ slug, raw }) =>
      `### ${slug}\n` + wrapUntrusted("untrusted_article_body", truncate(raw, LIMITS.maxBodyChars))
  );
  return {
    block: parts.length > 0 ? parts.join("\n\n") : "（本文を読み込んだ記事はありません）",
    inspected: raws.map((r) => r.slug),
  };
}

/** GSCスナップショットのプロンプト表現 */
export function gscBlock(snapshot: GscSnapshot): string {
  return asJsonBlock("untrusted_search_console", {
    totals: snapshot.totals,
    queries: snapshot.queries,
    pages: snapshot.pages,
    dataWarnings: snapshot.dataWarnings,
    lowData: snapshot.lowData,
  });
}

/**
 * 記事メタデータ索引のプロンプト表現（本文は含まない）。
 * @param withHeadings placementやカバー範囲の判断に見出しが要るPhaseでのみ true
 */
export function indexBlock(entries?: ArticleIndexEntry[], withHeadings = true): string {
  return asJsonBlock("untrusted_article_index", {
    articles: compactIndex(entries ?? getArticleIndex(), withHeadings),
    guides: GUIDE_PAGES.map((g) => ({
      url: g.pathname,
      title: g.title,
      editable: g.editable,
      note: g.note,
    })),
  });
}

/** 選択テーマのプロンプト表現 */
export function topicBlock(topic: SeoTopicCandidate): string {
  return asJsonBlock("untrusted_selected_topic", topic);
}
