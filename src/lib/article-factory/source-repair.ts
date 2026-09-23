/**
 * sources 由来の QA FAIL に限定した自動修復。
 *
 * ## なぜ必要か（根本原因）
 *
 * `research.unsupportedClaims` は**調査フェーズが「書きたかったが出典を確保できなかった主張」**の
 * 一覧であり、記事本文とは独立している。
 * 一方 `runWrite()` は `research.sources`（裏付けの取れた出典）だけを受け取るため、
 * 裏付けの無い主張は**そもそも本文に書かれていない可能性がある**。
 *
 * それにもかかわらず `runQa()` は `unsupportedClaims` の全件を無条件に FAIL とするため、
 * 出典が12件確保できていても、調査段階で落ちた主張が1件あるだけで
 * 記事は永久に公開できない状態になっていた。
 *
 * ## 方針
 *
 * QAの基準は**一切緩めない**。緩めるのではなく、FAILの原因そのものを解消する。
 *
 *   1. 対象の主張について**実際に追加Web検索**する
 *   2. 直接裏付ける出典が見つかった場合だけ、検証済みURLで引用を追加する
 *   3. 見つからない場合は、その主張を本文から削除するか、
 *      時事的・断定的でない表現へ弱める
 *   4. 本文に存在しない主張は、**保守的な判定で不在を確認できた場合のみ**取り下げる
 *
 * LLM が返した修復案は**すべて機械的に検証**してから適用する。
 * 検証済み集合に無いURL、本文に存在しない `find` 文字列、
 * 本文に痕跡が残る「不在」申告はすべて拒否する。
 */

import type { QaIssue, QaResult, ResearchResult, ResearchSource } from "./types";
import { normalizeSourceUrl } from "./url";

// ── QA失敗の分類（純粋関数） ──

export interface SourcesFailureClassification {
  /** FAIL が1件でもあるか */
  hasFail: boolean;
  /** FAIL がすべて sources カテゴリか（= 修復対象） */
  sourcesOnly: boolean;
  /** sources 以外の FAIL カテゴリ（あれば即停止） */
  otherCategories: string[];
  /** sources FAIL の対象文字列 */
  sourceTargets: string[];
}

/**
 * QA結果を分類する。
 *
 * sources 以外の FAIL が1件でも混ざっていれば修復対象にしない（従来どおり即停止）。
 */
export function classifySourcesFailure(qa: QaResult): SourcesFailureClassification {
  const fails = qa.issues.filter((i) => i.verdict === "FAIL");
  const sourceFails = fails.filter((i) => i.category === "sources");
  const others = fails.filter((i) => i.category !== "sources");

  return {
    hasFail: fails.length > 0,
    sourcesOnly: fails.length > 0 && others.length === 0,
    otherCategories: [...new Set(others.map((i) => i.category))],
    sourceTargets: sourceFails.map((i) => i.target),
  };
}

/** 修復対象の主張を取り出す（QAのtargetは切り詰められているため research 側を正とする） */
export function unsupportedClaimsToRepair(
  qa: QaResult,
  research: ResearchResult
): string[] {
  const c = classifySourcesFailure(qa);
  if (!c.sourcesOnly) return [];
  // research.unsupportedClaims が正本。QA target は表示用に60字で切られている。
  return [...research.unsupportedClaims];
}

// ── 本文中の主張の痕跡判定（純粋関数・保守的） ──

/**
 * 主張から「本文に残っていたら危険」な特徴的トークンを取り出す。
 *
 * 年・数値・割合・英数字の固有名詞など、言い換えでは消えにくいものだけを見る。
 * 助詞や一般語は対象にしない。
 */
export function distinctiveTokens(claim: string): string[] {
  const out = new Set<string>();

  // 年（2020〜2099）・和暦っぽい数値・パーセント・金額・倍率
  for (const m of claim.matchAll(/\d{4}年|\d+(?:\.\d+)?\s*[%％]|\d+(?:\.\d+)?\s*倍|\d+(?:,\d{3})+|\d+\s*万円/g)) {
    out.add(m[0].replace(/\s+/g, ""));
  }
  // 3文字以上の英数字トークン（固有名詞・略語）
  for (const m of claim.matchAll(/[A-Za-z][A-Za-z0-9._-]{2,}/g)) {
    out.add(m[0].toLowerCase());
  }
  return [...out];
}

/**
 * その主張が本文にまだ残っている可能性が高いか。
 *
 * **保守的**に判定する。特徴トークンが1つでも本文に残っていれば「残っている」とみなす。
 * 特徴トークンが取れない主張は、安全側に倒して「残っている」とみなす
 * （= 不在申告を受け付けない）。
 */
export function claimLikelyPresentInBody(claim: string, body: string): boolean {
  const tokens = distinctiveTokens(claim);
  if (tokens.length === 0) return true; // 判定不能 → 安全側
  const haystack = body.toLowerCase();
  return tokens.some((t) => haystack.includes(t.toLowerCase()));
}

// ── 修復プラン ──

export interface RepairCitation {
  /** 対象の主張 */
  claim: string;
  /** 追加Web検索で引用が確認できたURL */
  url: string;
  title: string;
  /** 本文中で出典を添える箇所（本文の既存部分と完全一致する必要がある） */
  anchorText: string | null;
}

export interface RepairEdit {
  claim: string;
  /** 本文中に完全一致で存在する必要がある */
  find: string;
  /** 置換後。削除なら空文字も可 */
  replace: string;
  action: "remove" | "soften";
}

export interface RepairPlan {
  citations: RepairCitation[];
  edits: RepairEdit[];
  /** 本文に存在しないと LLM が判断した主張 */
  notPresent: string[];
}

export interface RepairApplication {
  body: string;
  research: ResearchResult;
  /** 適用できた引用の数 */
  citationsAdded: number;
  /** 適用できた本文修正の数 */
  editsApplied: number;
  /** 本文に存在しないとして取り下げた主張の数 */
  claimsDropped: number;
  /** 解消できた主張 */
  resolvedClaims: string[];
  /** 機械検証で拒否した項目の理由 */
  rejected: string[];
}

/** 本文に既にそのURLが含まれているか（重複引用の防止） */
export function bodyAlreadyCites(body: string, url: string): boolean {
  const n = normalizeSourceUrl(url);
  if (!n) return false;
  // 正規化前後どちらの表記でも拾う
  return body.includes(url) || body.includes(n);
}

/** 出典の脚注行を作る */
function citationLine(title: string, url: string): string {
  return `\n\n> 出典: [${title}](${url})\n`;
}

/**
 * 修復プランを**機械的に検証しながら**適用する。
 *
 * 受け入れ条件:
 *   - citation: URL が追加検索の検証済み集合に含まれること
 *   - edit: `find` が現在の本文に完全一致で存在すること
 *   - notPresent: 本文に特徴トークンの痕跡が無いこと（保守的判定）
 *
 * いずれも満たさない項目は適用せず `rejected` に理由を残す。
 */
export function applyRepairPlan(input: {
  body: string;
  research: ResearchResult;
  plan: RepairPlan;
  /** 追加検索で url_citation が確認できたURL（正規化済みでなくてよい） */
  verifiedUrls: { url: string; title: string; authoritative: boolean }[];
  targetClaims: string[];
  retrievedAt: string;
}): RepairApplication {
  const { plan, targetClaims, retrievedAt } = input;
  let body = input.body;

  const verified = new Map<string, { title: string; authoritative: boolean }>();
  for (const v of input.verifiedUrls) {
    const n = normalizeSourceUrl(v.url);
    if (n) verified.set(n, { title: v.title, authoritative: v.authoritative });
  }

  const rejected: string[] = [];
  const resolved = new Set<string>();
  const newSources: ResearchSource[] = [];
  let citationsAdded = 0;
  let editsApplied = 0;
  let claimsDropped = 0;

  const isTarget = (claim: string) => targetClaims.includes(claim);

  // ── 1. 引用の追加 ──
  for (const c of plan.citations ?? []) {
    if (!isTarget(c.claim)) {
      rejected.push(`citation: 対象外の主張です — ${c.claim.slice(0, 40)}`);
      continue;
    }
    const n = normalizeSourceUrl(c.url);
    if (!n || !verified.has(n)) {
      // 検証済み集合に無いURLは捏造の可能性があるため採用しない
      rejected.push(`citation: 追加検索で確認できないURLです — ${c.url.slice(0, 60)}`);
      continue;
    }
    const meta = verified.get(n)!;

    if (bodyAlreadyCites(body, n)) {
      // 既に引用済み。重複追加はしないが、主張の裏付けとしては有効
      resolved.add(c.claim);
      newSources.push({
        title: meta.title || c.title || n,
        url: n,
        retrievedAt,
        supportsClaims: [c.claim],
        authoritative: meta.authoritative,
      });
      continue;
    }

    if (c.anchorText && body.includes(c.anchorText)) {
      body = body.replace(
        c.anchorText,
        `${c.anchorText}${citationLine(meta.title || c.title || n, n)}`
      );
    } else {
      body = `${body.replace(/\s+$/, "")}${citationLine(meta.title || c.title || n, n)}`;
    }
    citationsAdded++;
    resolved.add(c.claim);
    newSources.push({
      title: meta.title || c.title || n,
      url: n,
      retrievedAt,
      supportsClaims: [c.claim],
      authoritative: meta.authoritative,
    });
  }

  // ── 2. 本文の削除・弱め ──
  for (const e of plan.edits ?? []) {
    if (!isTarget(e.claim)) {
      rejected.push(`edit: 対象外の主張です — ${e.claim.slice(0, 40)}`);
      continue;
    }
    if (!e.find || !body.includes(e.find)) {
      rejected.push(`edit: 本文に一致する箇所がありません — ${(e.find || "").slice(0, 40)}`);
      continue;
    }
    body = body.replace(e.find, e.replace ?? "");
    editsApplied++;
    resolved.add(e.claim);
  }

  // ── 3. 本文に存在しない主張の取り下げ ──
  for (const claim of plan.notPresent ?? []) {
    if (!isTarget(claim)) {
      rejected.push(`notPresent: 対象外の主張です — ${claim.slice(0, 40)}`);
      continue;
    }
    if (claimLikelyPresentInBody(claim, body)) {
      // 本文に痕跡が残っている。取り下げは認めない（安全側）
      rejected.push(`notPresent: 本文に痕跡が残っています — ${claim.slice(0, 40)}`);
      continue;
    }
    claimsDropped++;
    resolved.add(claim);
  }

  // ── 4. research の更新 ──
  const remainingUnsupported = input.research.unsupportedClaims.filter(
    (c) => !resolved.has(c)
  );
  // 本文から取り除いた・弱めた主張は時事的主張の一覧からも外す
  const removedByEdit = new Set(
    (plan.edits ?? [])
      .filter((e) => resolved.has(e.claim))
      .map((e) => e.claim)
  );
  const remainingTimeSensitive = input.research.timeSensitiveClaims.filter(
    (c) => !removedByEdit.has(c) && !plan.notPresent?.includes(c)
  );

  const research: ResearchResult = {
    sources: mergeSources(input.research.sources, newSources),
    timeSensitiveClaims: remainingTimeSensitive,
    unsupportedClaims: remainingUnsupported,
  };

  return {
    body,
    research,
    citationsAdded,
    editsApplied,
    claimsDropped,
    resolvedClaims: [...resolved],
    rejected,
  };
}

/** 既存出典と新規出典を正規化URLでまとめる（重複させない） */
function mergeSources(existing: ResearchSource[], added: ResearchSource[]): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>();
  for (const s of [...existing, ...added]) {
    const n = normalizeSourceUrl(s.url) ?? s.url;
    const cur = byUrl.get(n);
    if (!cur) {
      byUrl.set(n, { ...s, url: n, supportsClaims: [...new Set(s.supportsClaims)] });
      continue;
    }
    cur.supportsClaims = [...new Set([...cur.supportsClaims, ...s.supportsClaims])];
    cur.authoritative = cur.authoritative || s.authoritative;
    if (!cur.title) cur.title = s.title;
  }
  return [...byUrl.values()];
}

// ── 修復ループの制御（純粋関数） ──

/** 修復を試みてよい回数の上限 */
export const MAX_SOURCE_REPAIR_ATTEMPTS = 2;

export type RepairDecision =
  | { action: "proceed" }
  | { action: "repair"; attempt: number; claims: string[] }
  | { action: "stop"; reason: string; code: string };

/**
 * QA結果から次の行動を決める。
 *
 * - FAIL なし → 先へ進む
 * - sources 以外の FAIL を含む → 即停止（従来どおり）
 * - sources のみ かつ 試行回数が上限未満 → 修復
 * - sources のみ だが上限到達 → 停止（PRは作らない）
 */
export function decideRepairAction(
  qa: QaResult,
  research: ResearchResult,
  attemptsUsed: number
): RepairDecision {
  const c = classifySourcesFailure(qa);

  if (!c.hasFail) return { action: "proceed" };

  if (!c.sourcesOnly) {
    const fails = qa.issues.filter((i) => i.verdict === "FAIL");
    return {
      action: "stop",
      code: "QA_FAIL",
      reason: `QAでFAILが${fails.length}件あります — ${fails
        .slice(0, 3)
        .map((i: QaIssue) => `${i.category}: ${i.message}`)
        .join(" / ")}`,
    };
  }

  if (attemptsUsed >= MAX_SOURCE_REPAIR_ATTEMPTS) {
    return {
      action: "stop",
      code: "QA_FAIL_SOURCES_UNREPAIRED",
      reason: `出典の自動修復を${MAX_SOURCE_REPAIR_ATTEMPTS}回試みましたが、裏付けの取れない主張が残りました（${research.unsupportedClaims.length}件）。PRは作成していません`,
    };
  }

  return {
    action: "repair",
    attempt: attemptsUsed + 1,
    claims: unsupportedClaimsToRepair(qa, research),
  };
}
