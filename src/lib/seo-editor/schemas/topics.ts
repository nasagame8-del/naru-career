/** PHASE 1 — 改善テーマ候補の JSON Schema */

import { obj, arr, str, num, bool, strArr, enumStr, nullableNum, CONFIDENCE_ENUM } from "../openai";

const TOPIC_TYPES = [
  "cluster_opportunity",
  "rewrite_opportunity",
  "cannibalization_risk",
  "ctr_opportunity",
  "new_demand",
] as const;

const POSSIBLE_ACTIONS = [
  "rewrite",
  "expand",
  "new_article",
  "internal_links",
  "merge",
  "title_meta",
] as const;

const query = obj({
  query: str,
  clicks: num,
  impressions: num,
  ctr: num,
  position: num,
  positionChange: nullableNum(),
  impressionChange: nullableNum(),
});

const candidate = obj({
  id: str,
  topic: str,
  type: enumStr(TOPIC_TYPES),
  reason: str,
  queries: arr(query),
  relatedPages: strArr,
  possibleActions: arr(enumStr(POSSIBLE_ACTIONS)),
  evidence: strArr,
  dataConfidence: enumStr(CONFIDENCE_ENUM),
  caveats: strArr,
});

export const TOPICS_SCHEMA = obj({
  candidates: arr(candidate),
  dataAssessment: str,
  lowDataWarning: bool,
});
