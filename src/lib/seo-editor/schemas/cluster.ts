/** PHASE 3 — Pillar / Cluster 監査の JSON Schema */

import { obj, arr, str, bool, strArr, enumStr, nullableStr, CONFIDENCE_ENUM } from "../openai";

const node = obj({
  slug: str,
  url: str,
  title: str,
  role: enumStr(["pillar", "cluster", "supporting"]),
  coverage: enumStr(["full", "partial", "thin"]),
  note: str,
});

const missing = obj({
  topic: str,
  searchIntent: str,
  canBeCoveredBy: nullableStr(),
  independentPageJustified: bool,
  reason: str,
});

const pillar = obj({
  status: enumStr(["existing", "candidate", "missing"]),
  url: nullableStr(),
  title: str,
  reason: str,
});

export const CLUSTER_SCHEMA = obj({
  pillar,
  nodes: arr(node),
  missingTopics: arr(missing),
  notes: strArr,
  confidence: enumStr(CONFIDENCE_ENUM),
});
