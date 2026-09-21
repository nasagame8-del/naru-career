/**
 * PHASE 5 — 内部リンク設計
 *
 * 存在しないURLへのリンクはコード側で機械的に除外する。
 * 新規作成予定の記事だけは、まだファイルが無くてもリンク先として許可する。
 */

import { runStructured } from "../openai";
import { LINKS_SCHEMA } from "../schemas/links";
import { LINKS_PROMPT } from "../prompts/links";
import { validateLinkPlan } from "../validate";
import { getIndexEntry, getKnownPathnames, toPathname } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock } from "../sanitize";
import { indexBlock, selectRelatedArticles, topicBlock } from "./shared";
import { buildGscSnapshot } from "../gsc-input";
import { getSearchConsoleData } from "../gsc-cache";
import type {
  ActionDecision,
  ClusterAudit,
  InternalLink,
  InternalLinkPlan,
  SeoTopicCandidate,
  SeoUsage,
} from "@/types/seo-editor";

export interface LinksPhaseResult {
  plan: InternalLinkPlan;
  usage: SeoUsage[];
  warnings: string[];
}

export async function runLinksPhase(
  topic: SeoTopicCandidate,
  actionDecision: ActionDecision | null,
  clusterAudit: ClusterAudit | null
): Promise<LinksPhaseResult> {
  const warnings: string[] = [];
  const { data } = await getSearchConsoleData();
  const snapshot = buildGscSnapshot(data);
  const related = selectRelatedArticles(topic, snapshot, 14);

  // 新規作成予定のパスも「利用可能なリンク先」に含める
  const plannedNew = (actionDecision?.decisions ?? [])
    .filter((d) => d.action === "CREATE")
    .map((d) => `/articles/${d.target}`);

  const known = getKnownPathnames();
  const allowedTargets = new Set<string>([...known, ...plannedNew]);
  // 変更対象になる記事のみがリンクの source になれる（既存記事も含む）
  const editableSources = new Set<string>(
    related.entries.map((e) => `/articles/${e.slug}`).concat(plannedNew)
  );
  for (const d of actionDecision?.decisions ?? []) {
    if (d.action !== "KEEP" && d.targetType !== "guide") {
      editableSources.add(`/articles/${d.target}`);
    }
  }

  const existingLinks = new Set<string>();
  for (const e of related.entries) {
    for (const out of e.internalLinksOut) existingLinks.add(`/articles/${e.slug}=>/articles/${out}`);
  }

  const input = [
    "# タスク",
    "",
    "対象クラスター全体の内部リンクを設計してください。新規・リライト記事だけでなく、既存関連記事側も対象です。",
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## Phase 3（Pillar / Cluster 監査）",
    asJsonBlock("untrusted_cluster_result", clusterAudit ?? "（監査結果なし）"),
    "",
    "## Phase 4（編集方針）",
    asJsonBlock("untrusted_action_decision", actionDecision ?? "（判断結果なし）"),
    "",
    "## 利用可能なリンク先（これ以外は使用禁止）",
    asJsonBlock("untrusted_allowed_targets", {
      targets: [...allowedTargets].sort(),
      plannedNewArticles: plannedNew,
      editableSources: [...editableSources].sort(),
    }),
    "",
    "## 既に存在する内部リンク（重複してADDしないこと）",
    asJsonBlock("untrusted_existing_links", [...existingLinks]),
    "",
    "## 関連記事の索引（placementに使うH2見出しを含む）",
    indexBlock(related.entries),
  ].join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_internal_link_plan",
    instructions: LINKS_PROMPT,
    input,
    schema: LINKS_SCHEMA,
  });

  const parsed = validateLinkPlan(raw);
  const links: InternalLink[] = [];
  const rejected: { link: InternalLink; reason: string }[] = [];
  const seen = new Set<string>();

  for (const link of parsed.links) {
    const source = toPathname(link.source);
    const target = toPathname(link.target);

    if (!source || !target) {
      rejected.push({ link, reason: "パスとして解釈できません" });
      continue;
    }
    if (!editableSources.has(source)) {
      rejected.push({ link, reason: `変更対象外のページをsourceにしています（${source}）` });
      continue;
    }
    if (!allowedTargets.has(target)) {
      rejected.push({ link, reason: `存在しないリンク先です（${target}）` });
      continue;
    }
    if (source === target) {
      rejected.push({ link, reason: "自己リンクです" });
      continue;
    }
    const key = `${source}=>${target}`;
    if (seen.has(key)) {
      rejected.push({ link, reason: "同一のリンクが重複しています" });
      continue;
    }
    if (link.operation === "ADD" && existingLinks.has(key)) {
      rejected.push({ link, reason: "既に同じ内部リンクが存在します" });
      continue;
    }
    if (!link.anchor.trim()) {
      rejected.push({ link, reason: "アンカーテキストが空です" });
      continue;
    }
    seen.add(key);
    links.push({ ...link, source, target });
  }

  // 同一アンカーの乱用を抑える
  const anchorCount = new Map<string, number>();
  const filtered: InternalLink[] = [];
  for (const link of links) {
    const c = (anchorCount.get(link.anchor) ?? 0) + 1;
    anchorCount.set(link.anchor, c);
    if (c > 3) {
      rejected.push({ link, reason: `同一アンカーテキストの使用が4回目のため除外しました` });
      continue;
    }
    filtered.push(link);
  }

  const capped = filtered.slice(0, LIMITS.maxLinks);
  if (filtered.length > LIMITS.maxLinks) {
    warnings.push(`内部リンクが${filtered.length}件あったため${LIMITS.maxLinks}件に制限しました`);
  }
  if (rejected.length > 0) {
    warnings.push(`${rejected.length}件の内部リンクを検証で除外しました`);
  }

  // リンク先が実在記事の場合、タイトルとアンカーの乖離を注意点として残す
  const notes = [...parsed.notes];
  for (const link of capped) {
    const m = link.target.match(/^\/articles\/([\w-]+)$/);
    const entry = m ? getIndexEntry(m[1]) : null;
    if (m && !entry) {
      notes.push(`${link.target} はこのRunで新規作成される記事です`);
    }
  }

  return { plan: { links: capped, notes, rejected }, usage: [usage], warnings };
}
