/** PHASE 6 — SEO Brief の JSON Schema */

import { obj, str, strArr, arr, enumStr } from "../openai";
import { ACTION_TYPES } from "./action";
import { LINK_SCHEMA_ITEM } from "./links";

export const BRIEF_SCHEMA = obj({
  target: str,
  action: enumStr(ACTION_TYPES),
  primaryIntent: str,
  targetReader: str,
  roleInCluster: str,
  mustAnswer: strArr,
  recommendedHeadings: strArr,
  firstPartyEvidence: strArr,
  internalLinksIn: arr(LINK_SCHEMA_ITEM),
  internalLinksOut: arr(LINK_SCHEMA_ITEM),
  preserve: strArr,
  doNotInvent: strArr,
});
