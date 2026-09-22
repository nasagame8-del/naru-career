/**
 * PHASE 6 — SEO Brief
 *
 * 執筆前の編集仕様書。KEEP以外の各対象について1件ずつ作る。
 * doNotInvent を必須項目として扱い、空なら既定値で埋める。
 */

import { runStructured } from "../openai";
import { BRIEF_SCHEMA } from "../schemas/brief";
import { BRIEF_PROMPT } from "../prompts/brief";
import { validateBrief } from "../validate";
import { getExperienceNotes, getIndexEntry, getRawArticle } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock, truncate, wrapUntrusted } from "../sanitize";
import { research } from "../research";
import { topicBlock } from "./shared";
import type {
  ActionDecisionItem,
  ResearchSource,
  SeoBrief,
  SeoRun,
  SeoUsage,
} from "@/types/seo-editor";

export interface BriefPhaseResult {
  brief: SeoBrief;
  usage: SeoUsage[];
  warnings: string[];
}

/** Brief を作る対象（KEEPは除く） */
export function briefTargets(run: SeoRun): ActionDecisionItem[] {
  return (run.actionDecision?.decisions ?? []).filter((d) => d.action !== "KEEP");
}

const DEFAULT_DO_NOT_INVENT = [
  "実話データ（prompts/experience-notes.md）に無い応募社数・内定数・年収",
  "利用していない転職サービスの利用経験",
  "存在しない面談・企業・人物",
  "出典を確認していない統計・制度・料金・法律",
];

export async function runBriefPhase(
  run: SeoRun,
  decision: ActionDecisionItem
): Promise<BriefPhaseResult> {
  const warnings: string[] = [];
  const topic = run.selectedTopic;
  if (!topic) throw new Error("テーマが選択されていません");

  const existing = decision.action === "CREATE" ? null : getRawArticle(decision.target);
  if (decision.action !== "CREATE" && !existing) {
    warnings.push(`対象記事「${decision.target}」の本文を読み込めませんでした`);
  }

  const linkPlan = run.internalLinks?.links ?? [];
  const targetPath = `/articles/${decision.target}`;
  const linksIn = linkPlan.filter((l) => l.target === targetPath);
  const linksOut = linkPlan.filter((l) => l.source === targetPath);

  // 外部調査（v1では無効。CREATE/大規模REWRITEのみ許可される設計）
  const researchResult = await research({
    topic: topic.topic,
    questions: decision.expandTopics,
    allowed: decision.action === "CREATE" || decision.action === "REWRITE",
  });
  const sources: ResearchSource[] = researchResult.sources;
  if (!researchResult.enabled && (decision.action === "CREATE" || decision.action === "REWRITE")) {
    warnings.push(`外部調査は実施していません: ${researchResult.reason}`);
  }

  const input = [
    "# タスク",
    "",
    `対象「${decision.target}」（アクション: ${decision.action}）のSEO編集仕様書を作成してください。`,
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## Phase 4 の判断",
    asJsonBlock("untrusted_action_decision_item", decision),
    "",
    "## Phase 3（Pillar / Cluster 監査）",
    asJsonBlock("untrusted_cluster_result", run.clusterAudit ?? "（監査結果なし）"),
    "",
    "## Phase 5（この記事に関係する内部リンク計画）",
    asJsonBlock("untrusted_link_plan", { internalLinksIn: linksIn, internalLinksOut: linksOut }),
    "",
    "## 実話データ（本人情報の正本）",
    wrapUntrusted("untrusted_experience_notes", getExperienceNotes()),
    "",
    "## 対象記事の現在の本文",
    existing
      ? wrapUntrusted("untrusted_article_body", truncate(existing, LIMITS.maxBodyChars))
      : "（新規作成のため既存本文はありません）",
    "",
    researchResult.notes.length > 0 ? "## 外部調査メモ" : "",
    researchResult.notes.length > 0
      ? wrapUntrusted("untrusted_research_notes", researchResult.notes.join("\n"))
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_brief",
    instructions: BRIEF_PROMPT,
    input,
    schema: BRIEF_SCHEMA,
  });

  const parsed = validateBrief(raw);

  // target / action はコード側の判断を正とする（AIに変えさせない）
  const brief: SeoBrief = {
    ...parsed,
    target: decision.target,
    action: decision.action,
    internalLinksIn: linksIn,
    internalLinksOut: linksOut,
    sources,
  };

  if (brief.doNotInvent.length === 0) {
    brief.doNotInvent = [...DEFAULT_DO_NOT_INVENT];
    warnings.push(`${decision.target}: doNotInventが空だったため既定の禁止事項を補いました`);
  }

  if (decision.action !== "CREATE" && brief.preserve.length === 0) {
    warnings.push(
      `${decision.target}: preserveが空です。既存記事から残す要素が指定されていません`
    );
  }

  if (brief.recommendedHeadings.length > 8) {
    brief.recommendedHeadings = brief.recommendedHeadings.slice(0, 8);
  }

  // 実話データに出てこない一次体験は落とす（完全一致ではなく語の存在で粗く検査）
  const notes = getExperienceNotes();
  if (notes) {
    const kept = brief.firstPartyEvidence.filter((ev) => {
      const tokens = ev.split(/[\s　、。,.「」（）()]+/).filter((t) => t.length >= 3);
      if (tokens.length === 0) return false;
      const hits = tokens.filter((t) => notes.includes(t)).length;
      return hits / tokens.length >= 0.4;
    });
    if (kept.length !== brief.firstPartyEvidence.length) {
      warnings.push(
        `${decision.target}: 実話データで裏付けが取れない一次体験を${brief.firstPartyEvidence.length - kept.length}件、Briefから除外しました`
      );
      brief.firstPartyEvidence = kept;
    }
  }

  if (decision.action !== "CREATE" && !getIndexEntry(decision.target)) {
    warnings.push(`${decision.target}: 索引に存在しない記事です`);
  }

  return { brief, usage: [usage], warnings };
}
