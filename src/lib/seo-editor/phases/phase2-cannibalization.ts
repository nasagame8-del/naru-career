/**
 * PHASE 2 — カニバリ監査
 *
 * まず title / description / H1 / H2 / category / URL / page×query で
 * 候補を絞り、必要な記事だけ本文を読み込む。
 */

import { runStructured } from "../openai";
import { CANNIBALIZATION_SCHEMA } from "../schemas/cannibalization";
import { CANNIBALIZATION_PROMPT } from "../prompts/cannibalization";
import { validateCannibalization } from "../validate";
import { buildGscSnapshot } from "../gsc-input";
import { getSearchConsoleData } from "../gsc-cache";
import { getIndexEntry } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock } from "../sanitize";
import { bodiesBlock, selectRelatedArticles, topicBlock } from "./shared";
import type { CannibalizationAudit, SeoTopicCandidate, SeoUsage } from "@/types/seo-editor";

export interface CannibalizationPhaseResult {
  audit: CannibalizationAudit;
  usage: SeoUsage[];
  warnings: string[];
}

export async function runCannibalizationPhase(
  topic: SeoTopicCandidate
): Promise<CannibalizationPhaseResult> {
  const { data } = await getSearchConsoleData();
  const snapshot = buildGscSnapshot(data);
  const warnings: string[] = [];

  const related = selectRelatedArticles(topic, snapshot, 12);

  if (related.entries.length === 0) {
    return {
      audit: {
        status: "NO_CONFLICT",
        pages: [],
        reason: "このテーマに関連する既存記事が見つかりませんでした。競合する対象がありません。",
        intentDifferences: [],
        recommendedAction: "既存記事との競合はありません。Phase 3でクラスター上の位置づけを確認してください。",
        confidence: "low",
        inspectedSlugs: [],
      },
      usage: [],
      warnings: ["関連する既存記事が0件でした"],
    };
  }

  // 本文まで読むのは上位のみ
  const { block, inspected } = bodiesBlock(related.slugs, LIMITS.maxBodiesForCannibalization);
  if (related.slugs.length > inspected.length) {
    warnings.push(
      `関連候補${related.slugs.length}件のうち、本文を確認したのは上位${inspected.length}件です`
    );
  }

  // 同一クエリで複数URLが出ている事実（カニバリの断定材料にはしない）
  const wanted = new Set(topic.queries.map((q) => q.query.toLowerCase()));
  const multiUrlQueries = snapshot.queries
    .filter((q) => wanted.has(q.query.toLowerCase()) && q.pages.length > 1)
    .map((q) => ({
      query: q.query,
      pages: q.pages.map((p) => ({ slug: p.slug, impressions: p.impressions, position: p.position })),
    }));

  const input = [
    "# タスク",
    "",
    "選択された検索テーマについて、既存記事間にカニバリが存在するかを監査してください。",
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## 関連候補記事のメタデータ",
    asJsonBlock(
      "untrusted_candidate_metadata",
      related.entries.map((e) => ({
        slug: e.slug,
        url: e.url,
        title: e.title,
        description: e.description,
        category: e.category,
        keyword: e.keyword,
        headings: e.headings,
        bodyInspected: inspected.includes(e.slug),
      }))
    ),
    "",
    "## 同一クエリで複数URLが表示されている事実",
    "（これ単独ではカニバリの証拠になりません）",
    asJsonBlock("untrusted_multi_url_queries", multiUrlQueries),
    "",
    "## 本文を確認した記事",
    block,
  ].join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_cannibalization_audit",
    instructions: CANNIBALIZATION_PROMPT,
    input,
    schema: CANNIBALIZATION_SCHEMA,
  });

  const parsed = validateCannibalization(raw);

  // 実在しない記事を落とす
  const pages = parsed.pages.filter((p) => {
    const entry = getIndexEntry(p.slug);
    if (!entry) {
      warnings.push(`カニバリ監査が存在しないslug「${p.slug}」を返したため除外しました`);
      return false;
    }
    return true;
  });

  // 本文未確認で STRONG / MERGE を断定させない
  let status = parsed.status;
  let confidence = parsed.confidence;
  const inspectedSet = new Set(inspected);
  const decidedOnUninspected =
    (status === "STRONG_CANNIBALIZATION" || status === "MERGE_CANDIDATE") &&
    pages.some((p) => !inspectedSet.has(p.slug));
  if (decidedOnUninspected) {
    status = "ROLE_CLARIFICATION_NEEDED";
    confidence = "low";
    warnings.push(
      "本文を確認していない記事を含む判定だったため、STRONG/MERGEからROLE_CLARIFICATION_NEEDEDへ引き下げました"
    );
  }

  return {
    audit: { ...parsed, status, confidence, pages, inspectedSlugs: inspected },
    usage: [usage],
    warnings,
  };
}
