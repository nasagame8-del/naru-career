/** PHASE 8 — 関連記事への内部リンク実装の JSON Schema */

import { obj, str, strArr, arr } from "../openai";

const applied = obj({
  target: str,
  anchor: str,
  /** 実際に挿入した段落の先頭30文字程度 */
  insertedNear: str,
});

export const RELATED_SCHEMA = obj({
  slug: str,
  /** frontmatterを除いた本文全体（リンク挿入後） */
  markdownBody: str,
  appliedLinks: arr(applied),
  /** 文脈的に不自然だったため挿入しなかったリンクとその理由 */
  skippedLinks: strArr,
  changeNotes: strArr,
});
