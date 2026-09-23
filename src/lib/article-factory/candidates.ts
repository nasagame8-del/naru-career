/**
 * 新規記事の候補生成。
 *
 * 原則:
 *   - 在庫（既存記事）を必ず読んでから候補を出す。
 *   - LLMの自己申告は信用しない。返ってきた候補は必ず safety.validateCandidate を通す。
 *   - Search Console データが無いときは searchEvidence を null にする。**捏造しない**。
 */

import { randomUUID } from "crypto";
import {
  runStructured,
  obj,
  arr,
  str,
  enumStr,
  strArr,
} from "@/lib/seo-editor/openai";
import { ARTICLE_FACTORY_MODEL_LIGHT, LIMITS, KNOWN_CATEGORIES, TOPIC_SCOPE } from "./config";
import { compactInventory, readInventory, type ArticleInventory } from "./inventory";
import { validateCandidate } from "./safety";
import type { ArticleCandidate, CandidateBatch, SearchIntent } from "./types";

/** LLMから受け取る生の候補（機械判定前） */
interface RawCandidate {
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  differenceFromExisting: string;
  reasonToWriteNow: string;
  category: string;
  proposedSlug: string;
  riskFlags: string[];
}

interface RawBatch {
  candidates: RawCandidate[];
}

const CANDIDATE_SCHEMA = obj({
  candidates: arr(
    obj({
      title: str,
      primaryKeyword: str,
      secondaryKeywords: strArr,
      searchIntent: enumStr(["know", "do", "compare", "decide"]),
      differenceFromExisting: str,
      reasonToWriteNow: str,
      category: enumStr(KNOWN_CATEGORIES),
      proposedSlug: str,
      riskFlags: strArr,
    })
  ),
});

const INSTRUCTIONS = `あなたは日本語メディア「NARU」の編集者です。

NARUのテーマは「${TOPIC_SCOPE.label}」に限定されています。

あなたの仕事は、**まだ存在しない新規記事**の候補を${LIMITS.minCandidates}〜${LIMITS.maxCandidates}件提案することです。

厳守事項:
- 既存記事一覧を必ず読み、検索意図が重複する候補は出さない。
- 「${TOPIC_SCOPE.label}」から外れる題材は出さない。
- Search Consoleのデータは与えられていない。検索ボリュームや順位を**推測して書かない**。
- proposedSlug は英小文字・数字・ハイフンのみ。既存slugと重複させない。
- differenceFromExisting には「既存のどの記事と比べて何が新しいか」を具体的に書く。
- reasonToWriteNow には「なぜ今この記事なのか」を書く。根拠が弱い場合は正直にそう書く。
- riskFlags には該当するものだけを入れる。使える値:
  CANNIBALIZATION / OUT_OF_SCOPE / REQUIRES_PERSONAL_EXPERIENCE /
  TIME_SENSITIVE_CLAIMS / YMYL_SENSITIVE / THIN_DIFFERENTIATION / NO_SEARCH_EVIDENCE
- 一人称の実体験を必要とする題材には必ず REQUIRES_PERSONAL_EXPERIENCE を付ける。
- 最新の制度・統計に依存する題材には必ず TIME_SENSITIVE_CLAIMS を付ける。`;

function isRawBatch(v: unknown): v is RawBatch {
  if (!v || typeof v !== "object") return false;
  const c = (v as RawBatch).candidates;
  return Array.isArray(c);
}

/** 記号を落として slug の体裁へ寄せる（LLMが崩した場合の保険） */
function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export interface GenerateCandidatesOptions {
  trigger: "cron" | "manual";
  /** テスト用に在庫を差し替える */
  inventory?: ArticleInventory;
}

/**
 * 候補バッチを生成する。
 *
 * 返ってくるバッチの候補は、機械判定済み（blocked が確定している）。
 */
export async function generateCandidateBatch(
  opts: GenerateCandidatesOptions
): Promise<CandidateBatch> {
  const inventory = opts.inventory ?? readInventory();
  const notes: string[] = [];

  // Search Console はこのフェーズでは参照しない。根拠が無いことを明示する。
  notes.push(
    "Search Console のデータは候補生成に使用していません。searchEvidence は null のままです（推測で埋めていません）。"
  );

  const input = [
    "<existing_articles>",
    JSON.stringify(compactInventory(inventory), null, 1),
    "</existing_articles>",
    "",
    `既存記事は ${inventory.size} 本です。`,
    `${LIMITS.minCandidates}〜${LIMITS.maxCandidates}件の新規記事候補を提案してください。`,
  ].join("\n");

  const { data } = await runStructured<RawBatch>({
    name: "article_candidates",
    instructions: INSTRUCTIONS,
    input,
    schema: CANDIDATE_SCHEMA,
    model: ARTICLE_FACTORY_MODEL_LIGHT,
    validate: isRawBatch,
  });

  const batchId = `batch_${new Date().toISOString().slice(0, 10)}_${randomUUID().slice(0, 8)}`;

  const seen = new Set<string>();
  const candidates: ArticleCandidate[] = [];

  for (const raw of data.candidates.slice(0, LIMITS.maxCandidates)) {
    const slug = normalizeSlug(raw.proposedSlug || raw.title);
    if (seen.has(slug)) continue;
    seen.add(slug);

    const base: ArticleCandidate = {
      id: `cand_${randomUUID().slice(0, 8)}`,
      title: raw.title,
      primaryKeyword: raw.primaryKeyword,
      secondaryKeywords: Array.isArray(raw.secondaryKeywords) ? raw.secondaryKeywords : [],
      searchIntent: raw.searchIntent,
      differenceFromExisting: raw.differenceFromExisting,
      reasonToWriteNow: raw.reasonToWriteNow,
      category: raw.category,
      proposedSlug: slug,
      // LLMが返したフラグのうち、既知の値だけを引き継ぐ
      riskFlags: (raw.riskFlags ?? []).filter((f): f is ArticleCandidate["riskFlags"][number] =>
        [
          "CANNIBALIZATION",
          "OUT_OF_SCOPE",
          "REQUIRES_PERSONAL_EXPERIENCE",
          "TIME_SENSITIVE_CLAIMS",
          "YMYL_SENSITIVE",
          "THIN_DIFFERENTIATION",
          "NO_SEARCH_EVIDENCE",
        ].includes(f)
      ),
      nearestExistingSlugs: [],
      searchEvidence: null,
      blocked: false,
      blockedReasons: [],
    };

    candidates.push(validateCandidate(base, inventory.existing));
  }

  if (candidates.length < LIMITS.minCandidates) {
    notes.push(
      `生成できた候補は ${candidates.length} 件で、下限 ${LIMITS.minCandidates} 件を下回りました。既存記事との重複が多い可能性があります。`
    );
  }

  const blockedCount = candidates.filter((c) => c.blocked).length;
  if (blockedCount > 0) {
    notes.push(`機械判定で ${blockedCount} 件が実行不可（blocked）と判定されました。`);
  }

  return {
    batchId,
    generatedAt: new Date().toISOString(),
    trigger: opts.trigger,
    candidates,
    inventorySize: inventory.size,
    nextArticleId: inventory.nextArticleId,
    notes,
  };
}

/** 候補数の下限・上限を満たしているか（UI表示用） */
export function batchMeetsQuota(batch: CandidateBatch): boolean {
  const usable = batch.candidates.filter((c) => !c.blocked).length;
  return usable >= LIMITS.minCandidates;
}
