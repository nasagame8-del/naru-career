/** PHASE 2 — カニバリ監査の JSON Schema */

import { obj, arr, str, strArr, enumStr, CONFIDENCE_ENUM } from "../openai";

const STATUSES = [
  "NO_CONFLICT",
  "INTENT_OVERLAP",
  "STRONG_CANNIBALIZATION",
  "MERGE_CANDIDATE",
  "ROLE_CLARIFICATION_NEEDED",
] as const;

const page = obj({
  slug: str,
  url: str,
  title: str,
  searchIntent: str,
  targetReader: str,
  role: str,
  sharedQueries: strArr,
});

export const CANNIBALIZATION_SCHEMA = obj({
  status: enumStr(STATUSES),
  pages: arr(page),
  reason: str,
  intentDifferences: strArr,
  recommendedAction: str,
  confidence: enumStr(CONFIDENCE_ENUM),
});
