/**
 * 修復プランの生成（LLM + 追加Web検索）。
 *
 * **このモジュールは OpenAI / process.env に依存する。**
 * したがって "use workflow" 本体から import してはならない。
 * 必ず "use step" 関数の内部からのみ使うこと。
 *
 * 純粋な判定・適用ロジックは source-repair.ts 側にある。
 */

import { runStructured, obj, arr, str, strArr, enumStr } from "@/lib/seo-editor/openai";
import { performClaimSearch, type SearchOutcome } from "./research";
import { ARTICLE_FACTORY_MODEL } from "./config";
import type { RepairPlan } from "./source-repair";
//
// この関数は OpenAI / Web検索に触れるため、必ず "use step" 側から呼ぶこと。
// "use workflow" 本体からは呼ばない。


const REPAIR_SCHEMA = obj({
  citations: arr(
    obj({
      claim: str,
      url: str,
      title: str,
      anchorText: str,
    })
  ),
  edits: arr(
    obj({
      claim: str,
      find: str,
      replace: str,
      action: enumStr(["remove", "soften"]),
    })
  ),
  notPresent: strArr,
});

interface RawPlan {
  citations: { claim: string; url: string; title: string; anchorText: string }[];
  edits: { claim: string; find: string; replace: string; action: string }[];
  notPresent: string[];
}

function isRawPlan(v: unknown): v is RawPlan {
  if (!v || typeof v !== "object") return false;
  const p = v as RawPlan;
  return Array.isArray(p.citations) && Array.isArray(p.edits) && Array.isArray(p.notPresent);
}

export interface PlanSourceRepairResult {
  plan: RepairPlan;
  verifiedUrls: { url: string; title: string; authoritative: boolean }[];
  /** 追加検索が使えなかった場合の理由 */
  searchError: string | null;
}

/**
 * 裏付けの取れていない主張について、追加検索したうえで修復プランを作る。
 *
 * モデルには**追加検索で引用が確認できたURLの一覧だけ**を渡す。
 * それでも一覧外のURLが返る可能性があるため、
 * 最終的な受理判断は applyRepairPlan（純粋関数）が機械的に行う。
 */
export async function planSourceRepair(input: {
  claims: string[];
  body: string;
  context: { title: string; primaryKeyword: string };
}): Promise<PlanSourceRepairResult> {
  let outcome: SearchOutcome;
  try {
    outcome = await performClaimSearch(input.claims, input.context);
  } catch (e) {
    // 追加検索が使えない場合でも、本文からの削除・弱めによる修復は可能にする
    outcome = { verified: [], summary: "" };
    return {
      plan: await planWithoutNewSources(input),
      verifiedUrls: [],
      searchError: e instanceof Error ? e.message.slice(0, 200) : "追加検索に失敗しました",
    };
  }

  const { data } = await runStructured<RawPlan>({
    name: "article_source_repair",
    instructions: [
      "記事本文のうち、出典による裏付けが取れていない主張を修復してください。",
      "",
      "取れる手段は次の3つだけです。",
      "",
      "1. citations — 追加検索で確認できた出典が、その主張を**直接裏付ける**場合のみ。",
      "   url は **与えられた検証済みURL一覧に載っているURLだけ**。一覧に無いURLを書かないこと。",
      "   anchorText には、本文中の該当箇所の文字列を**完全一致で**書き写すこと。",
      "   該当箇所が特定できなければ空文字にすること。",
      "2. edits — 裏付けが見つからない主張が本文にある場合、その箇所を削除するか、",
      "   時事的・断定的でない正確な表現へ弱める。",
      "   find には本文中の文字列を**完全一致で**書き写すこと（1文字でも違うと適用されない）。",
      "   action は remove（削除）か soften（弱める）。",
      "   soften の場合、replace は年・統計・断定を含まない一般的な表現にすること。",
      "3. notPresent — その主張がそもそも本文に書かれていない場合のみ列挙する。",
      "   本文を実際に確認すること。少しでも記述があれば notPresent に入れないこと。",
      "",
      "禁止:",
      "- URLの創作。検証済み一覧に無いURLを書くこと。",
      "- 主張と無関係な出典を付けること。",
      "- 本文に無い文字列を find / anchorText に書くこと。",
      "- 一人称の実体験を新たに書き加えること。",
      "- frontmatter や内部リンクの書き換え。",
    ].join("\n"),
    input: [
      "<article_context>",
      JSON.stringify(input.context, null, 1),
      "</article_context>",
      "<unsupported_claims>",
      ...input.claims.map((c, i) => `${i + 1}. ${c}`),
      "</unsupported_claims>",
      "<verified_urls>",
      JSON.stringify(
        outcome.verified.map((v) => ({ title: v.title, url: v.url })),
        null,
        1
      ),
      "</verified_urls>",
      "<search_summary>",
      outcome.summary.slice(0, 8000),
      "</search_summary>",
      "<body>",
      input.body,
      "</body>",
    ].join("\n"),
    schema: REPAIR_SCHEMA,
    model: ARTICLE_FACTORY_MODEL,
    validate: isRawPlan,
  });

  return {
    plan: normalizePlan(data),
    verifiedUrls: outcome.verified,
    searchError: null,
  };
}

/** 追加検索が使えない場合: 削除・弱めだけで修復案を作る */
async function planWithoutNewSources(input: {
  claims: string[];
  body: string;
  context: { title: string; primaryKeyword: string };
}): Promise<RepairPlan> {
  const { data } = await runStructured<RawPlan>({
    name: "article_source_repair_no_search",
    instructions: [
      "追加のWeb検索が利用できません。出典を新たに追加することはできません。",
      "裏付けの取れていない主張について、本文から削除するか、",
      "時事的・断定的でない表現へ弱めてください。",
      "",
      "- citations は必ず空配列にすること（出典を追加できないため）。",
      "- find には本文中の文字列を完全一致で書き写すこと。",
      "- 本文に存在しない主張は notPresent に入れること。",
      "- URLを創作しないこと。",
    ].join("\n"),
    input: [
      "<unsupported_claims>",
      ...input.claims.map((c, i) => `${i + 1}. ${c}`),
      "</unsupported_claims>",
      "<body>",
      input.body,
      "</body>",
    ].join("\n"),
    schema: REPAIR_SCHEMA,
    model: ARTICLE_FACTORY_MODEL,
    validate: isRawPlan,
  });

  const plan = normalizePlan(data);
  // 検索できていない以上、出典追加は認めない
  plan.citations = [];
  return plan;
}

function normalizePlan(raw: RawPlan): RepairPlan {
  return {
    citations: (raw.citations ?? []).map((c) => ({
      claim: c.claim,
      url: c.url,
      title: c.title,
      anchorText: c.anchorText && c.anchorText.trim() !== "" ? c.anchorText : null,
    })),
    edits: (raw.edits ?? []).map((e) => ({
      claim: e.claim,
      find: e.find,
      replace: e.replace ?? "",
      action: e.action === "remove" ? "remove" : "soften",
    })),
    notPresent: raw.notPresent ?? [],
  };
}
