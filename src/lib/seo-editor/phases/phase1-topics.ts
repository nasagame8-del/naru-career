/**
 * PHASE 1 — 改善テーマ選定
 *
 * Search Console データはサーバー側で取得する（gsc-cache 経由）。
 * ここだけが人間の判断ポイントで、出力はDashboardのカードになる。
 */

import { runStructured } from "../openai";
import { TOPICS_SCHEMA } from "../schemas/topics";
import { TOPICS_PROMPT } from "../prompts/topics";
import { validateTopicSelection } from "../validate";
import { buildGscSnapshot, type GscSnapshot } from "../gsc-input";
import { getSearchConsoleData } from "../gsc-cache";
import { getArticleIndex, getIndexEntry } from "../corpus";
import { LIMITS } from "../config";
import { gscBlock, indexBlock } from "./shared";
import type { SeoTopicSelection, SeoUsage } from "@/types/seo-editor";

export interface TopicsPhaseResult {
  selection: SeoTopicSelection;
  snapshot: GscSnapshot;
  usage: SeoUsage[];
  warnings: string[];
  gscFromCache: boolean;
}

export async function runTopicsPhase(refreshGsc = false): Promise<TopicsPhaseResult> {
  const { data, fromCache } = await getSearchConsoleData(refreshGsc);
  const snapshot = buildGscSnapshot(data);

  const warnings: string[] = [...snapshot.dataWarnings];

  // データが全く無い場合はLLMを呼ばない（コストと誤誘導の回避）
  if (!snapshot.configured || (snapshot.queries.length === 0 && snapshot.pages.length === 0)) {
    return {
      selection: {
        candidates: [],
        dataAssessment:
          snapshot.error ??
          "Search Consoleに分析できるデータがありません。改善テーマを提示できません。",
        lowDataWarning: true,
      },
      snapshot,
      usage: [],
      warnings,
      gscFromCache: fromCache,
    };
  }

  const input = [
    "# タスク",
    "",
    "以下のSearch Consoleデータと既存記事の索引から、いま改善する価値がある検索テーマを最大5件提示してください。",
    "",
    "## Search Console（サーバー側で取得した実測値）",
    gscBlock(snapshot),
    "",
    "## 既存記事の索引（本文・見出しは含みません）",
    indexBlock(undefined, false),
  ].join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_topic_candidates",
    instructions: TOPICS_PROMPT,
    input,
    schema: TOPICS_SCHEMA,
  });

  const parsed = validateTopicSelection(raw);
  const selection = postProcess(parsed, snapshot, warnings);

  return { selection, snapshot, usage: [usage], warnings, gscFromCache: fromCache };
}

/** LLM出力をコード側の事実で補正する（存在しないページの除去・確度の下方修正） */
function postProcess(
  selection: SeoTopicSelection,
  snapshot: GscSnapshot,
  warnings: string[]
): SeoTopicSelection {
  const knownPages = new Set(snapshot.pages.map((p) => p.page));
  for (const q of snapshot.queries) for (const p of q.pages) knownPages.add(p.page);

  const seenIds = new Set<string>();
  const candidates = selection.candidates
    .slice(0, LIMITS.maxTopicCandidates)
    .map((c, i) => {
      let id = c.id.trim() || `topic-${i + 1}`;
      if (seenIds.has(id)) id = `${id}-${i + 1}`;
      seenIds.add(id);

      // 実在しないページURLを落とす
      const relatedPages = c.relatedPages.filter((url) => {
        if (knownPages.has(url)) return true;
        const m = url.match(/\/articles\/([\w-]+)/);
        return Boolean(m && getIndexEntry(m[1]));
      });

      // 少数データを過大評価しない: 根拠クエリが薄ければ確度を下げる
      const maxImpressions = c.queries.reduce((a, q) => Math.max(a, q.impressions), 0);
      const dataConfidence =
        snapshot.lowData || maxImpressions < 5
          ? "low"
          : maxImpressions < 20 && c.dataConfidence === "high"
            ? "medium"
            : c.dataConfidence;

      const caveats = [...c.caveats];
      if (dataConfidence !== c.dataConfidence) {
        caveats.push(
          `根拠クエリの最大表示回数が${maxImpressions}回のため、確度を${c.dataConfidence}から${dataConfidence}へ引き下げました`
        );
      }
      if (relatedPages.length !== c.relatedPages.length) {
        caveats.push("実在が確認できないページURLを関連ページから除外しました");
      }

      return { ...c, id, relatedPages, dataConfidence, caveats };
    });

  if (selection.candidates.length > LIMITS.maxTopicCandidates) {
    warnings.push(
      `候補が${selection.candidates.length}件返されたため、上位${LIMITS.maxTopicCandidates}件に制限しました`
    );
  }
  if (getArticleIndex().length === 0) {
    warnings.push("記事が1本も読み込めていません（content/articles が空の可能性があります）");
  }

  return {
    ...selection,
    candidates,
    lowDataWarning: selection.lowDataWarning || snapshot.lowData,
  };
}
