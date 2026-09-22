/**
 * PHASE 4 — 新規 / リライト判断
 *
 * KEEP / REWRITE / EXPAND / CREATE / MERGE の5種類のみ。
 * 新規記事をデフォルトにしないためのガードをコード側にも置く。
 */

import { runStructured } from "../openai";
import { ACTION_SCHEMA } from "../schemas/action";
import { ACTION_PROMPT } from "../prompts/action";
import { validateActionDecision } from "../validate";
import { getIndexEntry } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock } from "../sanitize";
import { indexBlock, selectRelatedArticles, topicBlock } from "./shared";
import { buildGscSnapshot } from "../gsc-input";
import { getSearchConsoleData } from "../gsc-cache";
import type {
  ActionDecision,
  ActionDecisionItem,
  CannibalizationAudit,
  ClusterAudit,
  SeoTopicCandidate,
  SeoUsage,
} from "@/types/seo-editor";

export interface ActionPhaseResult {
  decision: ActionDecision;
  usage: SeoUsage[];
  warnings: string[];
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function runActionPhase(
  topic: SeoTopicCandidate,
  cannibalization: CannibalizationAudit | null,
  clusterAudit: ClusterAudit | null
): Promise<ActionPhaseResult> {
  const warnings: string[] = [];
  const { data } = await getSearchConsoleData();
  const snapshot = buildGscSnapshot(data);
  const related = selectRelatedArticles(topic, snapshot, 12);

  const input = [
    "# タスク",
    "",
    "Phase 2・3の結果を踏まえ、このテーマを育てるために必要な最小限の編集方針を決めてください。",
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## Phase 2（カニバリ監査）",
    asJsonBlock("untrusted_cannibalization_result", cannibalization ?? "（監査結果なし）"),
    "",
    "## Phase 3（Pillar / Cluster 監査）",
    asJsonBlock("untrusted_cluster_result", clusterAudit ?? "（監査結果なし）"),
    "",
    "## 関連記事の索引",
    indexBlock(related.entries),
  ].join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_action_decision",
    instructions: ACTION_PROMPT,
    input,
    schema: ACTION_SCHEMA,
  });

  const parsed = validateActionDecision(raw);
  const decisions: ActionDecisionItem[] = [];

  // Phase 3 で「既存記事で回答可能」とされたテーマ
  const coverableTopics = new Set(
    (clusterAudit?.missingTopics ?? [])
      .filter((mt) => mt.canBeCoveredBy !== null)
      .map((mt) => mt.topic)
  );
  const justifiedNewTopics = (clusterAudit?.missingTopics ?? []).filter(
    (mt) => mt.independentPageJustified && mt.canBeCoveredBy === null
  );

  for (const d of parsed.decisions) {
    // 既存記事を指すはずのアクションで、実在しないslugは落とす
    if (d.action !== "CREATE" && d.targetType === "article" && !getIndexEntry(d.target)) {
      warnings.push(`存在しない記事「${d.target}」への${d.action}判断を除外しました`);
      continue;
    }

    if (d.action === "CREATE") {
      if (!SLUG_RE.test(d.target)) {
        warnings.push(`新規slug「${d.target}」の形式が不正なためCREATE判断を除外しました`);
        continue;
      }
      if (getIndexEntry(d.target)) {
        warnings.push(
          `新規作成対象「${d.target}」は既に存在するため、CREATEをREWRITEへ変更しました`
        );
        decisions.push({ ...d, action: "REWRITE", targetType: "article" });
        continue;
      }
      // Phase 3 が新規ページを正当化していないCREATEは却下
      if (justifiedNewTopics.length === 0) {
        warnings.push(
          `Phase 3が独立ページを正当化していないため、新規記事「${d.target}」の作成を却下しました`
        );
        continue;
      }
      if (coverableTopics.size > 0 && justifiedNewTopics.length === 0) {
        warnings.push(`既存記事で回答可能なテーマのためCREATEを却下しました: ${d.target}`);
        continue;
      }
    }

    if (d.action === "MERGE") {
      if (cannibalization?.status !== "MERGE_CANDIDATE") {
        warnings.push(
          `Phase 2がMERGE_CANDIDATEではないため、「${d.target}」の統合をREWRITEへ変更しました`
        );
        decisions.push({ ...d, action: "REWRITE", mergeInto: null });
        continue;
      }
      if (!d.mergeInto || !getIndexEntry(d.mergeInto)) {
        warnings.push(`統合先が不正なため、「${d.target}」のMERGEを除外しました`);
        continue;
      }
    }

    if (d.action !== "KEEP" && d.targetType === "guide") {
      warnings.push(
        `ガイドページ（${d.target}）はTSXのため変更対象外です。内部リンク設計でのみ扱います`
      );
      continue;
    }

    decisions.push(d);
  }

  // 変更件数の上限（暴走防止）
  const changing = decisions.filter((d) => d.action !== "KEEP");
  if (changing.length > LIMITS.maxChanges) {
    warnings.push(
      `変更対象が${changing.length}件あったため、上位${LIMITS.maxChanges}件に制限しました`
    );
  }
  const kept = [
    ...decisions.filter((d) => d.action === "KEEP"),
    ...changing.slice(0, LIMITS.maxChanges),
  ];

  const newArticles = kept.filter((d) => d.action === "CREATE").length;
  if (newArticles > 1) {
    warnings.push(`1回のRunで新規記事が${newArticles}件提案されています。本当に必要か確認してください`);
  }

  return {
    decision: { decisions: kept, summary: parsed.summary, warnings },
    usage: [usage],
    warnings,
  };
}
