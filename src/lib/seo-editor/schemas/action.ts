/** PHASE 4 — 新規 / リライト判断の JSON Schema */

import { obj, arr, str, strArr, enumStr, nullableStr } from "../openai";

export const ACTION_TYPES = ["KEEP", "REWRITE", "EXPAND", "CREATE", "MERGE"] as const;

const decision = obj({
  target: str,
  targetType: enumStr(["article", "new_article", "guide"]),
  action: enumStr(ACTION_TYPES),
  reason: str,
  evidence: strArr,
  risk: str,
  mergeInto: nullableStr(),
  expandTopics: strArr,
});

export const ACTION_SCHEMA = obj({
  decisions: arr(decision),
  summary: str,
});
