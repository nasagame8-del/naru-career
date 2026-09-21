/**
 * PHASE 3 — Pillar / Cluster 監査
 *
 * 記事メタデータのみで判断する（本文は送らない）。
 * MISSING = 新規記事ではない。既存記事で回答可能かを必ず判定させる。
 */

import { runStructured } from "../openai";
import { CLUSTER_SCHEMA } from "../schemas/cluster";
import { CLUSTER_PROMPT } from "../prompts/cluster";
import { validateClusterAudit } from "../validate";
import { getIndexEntry, GUIDE_PAGES, toPathname } from "../corpus";
import { asJsonBlock } from "../sanitize";
import { indexBlock, topicBlock } from "./shared";
import type {
  CannibalizationAudit,
  ClusterAudit,
  SeoTopicCandidate,
  SeoUsage,
} from "@/types/seo-editor";

export interface ClusterPhaseResult {
  audit: ClusterAudit;
  usage: SeoUsage[];
  warnings: string[];
}

export async function runClusterPhase(
  topic: SeoTopicCandidate,
  cannibalization: CannibalizationAudit | null
): Promise<ClusterPhaseResult> {
  const warnings: string[] = [];

  const input = [
    "# タスク",
    "",
    "選択されたテーマについて、既存コンテンツのPillar / Cluster / Supporting構造を整理し、",
    "不足しているテーマを洗い出してください。",
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## Phase 2（カニバリ監査）の結果",
    asJsonBlock("untrusted_cannibalization_result", cannibalization ?? "（監査結果なし）"),
    "",
    "## 既存記事の索引とガイドページ",
    indexBlock(),
  ].join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_cluster_audit",
    instructions: CLUSTER_PROMPT,
    input,
    schema: CLUSTER_SCHEMA,
  });

  const parsed = validateClusterAudit(raw);

  const guidePaths = new Set<string>(GUIDE_PAGES.map((g) => g.pathname));

  // 実在しない記事ノードを落とす
  const nodes = parsed.nodes.filter((n) => {
    if (getIndexEntry(n.slug)) return true;
    const p = toPathname(n.url);
    if (p && guidePaths.has(p)) return true;
    warnings.push(`クラスター監査が存在しない記事「${n.slug}」を返したため除外しました`);
    return false;
  });

  // Pillar URL の実在確認
  let pillar = parsed.pillar;
  if (pillar.url) {
    const p = toPathname(pillar.url);
    const slugMatch = p?.match(/^\/articles\/([\w-]+)$/);
    const exists = Boolean(p && (guidePaths.has(p) || (slugMatch && getIndexEntry(slugMatch[1]))));
    if (!exists) {
      warnings.push(`Pillarとして存在しないURL「${pillar.url}」が返されたため missing に変更しました`);
      pillar = { ...pillar, status: "missing", url: null };
    }
  }

  // canBeCoveredBy が実在しない記事を指していたら null に落とす
  const missingTopics = parsed.missingTopics.map((mt) => {
    if (mt.canBeCoveredBy && !getIndexEntry(mt.canBeCoveredBy)) {
      warnings.push(
        `不足テーマ「${mt.topic}」のcanBeCoveredByが存在しない記事「${mt.canBeCoveredBy}」だったためnullにしました`
      );
      return { ...mt, canBeCoveredBy: null };
    }
    // 既存記事で回答できるなら独立ページは正当化しない
    if (mt.canBeCoveredBy && mt.independentPageJustified) {
      warnings.push(
        `不足テーマ「${mt.topic}」は既存記事(${mt.canBeCoveredBy})で回答可能なため、独立ページの正当化を取り消しました`
      );
      return { ...mt, independentPageJustified: false };
    }
    return mt;
  });

  return { audit: { ...parsed, pillar, nodes, missingTopics }, usage: [usage], warnings };
}
