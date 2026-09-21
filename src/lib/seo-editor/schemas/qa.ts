/** PHASE 9 — QA の JSON Schema */

import { obj, arr, str, strArr, enumStr } from "../openai";

export const QA_VERDICTS = ["PASS", "NEEDS_REVIEW", "FAIL"] as const;

/** LLMが判定するカテゴリ。機械判定できるものはコード側で処理する */
const LLM_CATEGORIES = ["FACT", "EXPERIENCE", "SEARCH_INTENT", "CANNIBALIZATION"] as const;

const issue = obj({
  category: enumStr(LLM_CATEGORIES),
  verdict: enumStr(QA_VERDICTS),
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
