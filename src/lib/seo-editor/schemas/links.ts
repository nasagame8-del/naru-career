/** PHASE 5 — 内部リンク設計の JSON Schema */

import { obj, arr, str, strArr, enumStr } from "../openai";

export const LINK_SCHEMA_ITEM = obj({
  source: str,
  target: str,
  placement: str,
  anchor: str,
  reason: str,
  operation: enumStr(["ADD", "UPDATE", "REMOVE"]),
});

export const LINKS_SCHEMA = obj({
  links: arr(LINK_SCHEMA_ITEM),
  notes: strArr,
});
