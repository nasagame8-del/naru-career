/** PHASE 9 — QA の JSON Schema */

import { obj, arr, str, strArr, enumStr } from "../openai";

export const QA_VERDICTS = ["PASS", "NEEDS_REVIEW", "FAIL"] as const;

/** LLMが判定するカテゴリ。機械判定できるものはコード側で処理する */
const LLM_CATEGORIES = ["FACT", "EXPERIENCE", "SEARCH_INTENT", "CANNIBALIZATION"] as const;

/** その問題を今回の変更が発生・悪化させたか。ゲートの基準になる */
const ORIGINS = ["INTRODUCED", "REGRESSED", "PRE_EXISTING", "UNKNOWN"] as const;

const issue = obj({
  category: enumStr(LLM_CATEGORIES),
  /** 問題の深刻度。ゲートの可否は origin と組み合わせてコード側が決める */
  verdict: enumStr(QA_VERDICTS),
  origin: enumStr(ORIGINS),
  location: str,
  message: str,
  evidence: str,
  /** scripts/proofread.js と同じ分類。FACT/EXPERIENCE以外では "NONE" */
  factCategory: enumStr(["CONTRADICTION", "UNSUPPORTED", "AMBIGUOUS", "NONE"]),
});

export const QA_SCHEMA = obj({
  overall: enumStr(QA_VERDICTS),
  issues: arr(issue),
  summary: str,
  externalVerificationItems: strArr,
});
