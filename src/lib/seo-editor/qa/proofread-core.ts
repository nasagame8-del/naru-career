/**
 * 校正・事実整合性検査の共通思想。
 *
 * 出典: scripts/proofread.js の SYSTEM_PROMPT。
 * CONTRADICTION / UNSUPPORTED / AMBIGUOUS の分類、厳守事項、判定基準を
 * SEO Editor の PHASE 9 でも同じ基準で使うために、ここに切り出している。
 *
 * ※ scripts/proofread.js は Node から直接実行される CommonJS スクリプトのため、
 *   このTSモジュールを require できない。両者を変更する際は必ず同期させること。
 *   （scripts/proofread.js 側にも同じ注記あり）
 */

import type { QaOrigin, QaVerdict } from "@/types/seo-editor";

/** 実話データとの整合性検査の分類定義 */
export const FACT_CATEGORY_RULES = `## 実話データとの整合性検査

記事内の体験談、出来事、時系列、数値、固有名詞、人物関係および因果関係を、
提供された実話データと比較してください。

問題を次の種類に分類してください。

### CONTRADICTION
記事の記述が、実話データと明確に矛盾している。

### UNSUPPORTED
記事では事実または実体験として断定されているが、それを裏付ける情報が実話データに存在しない。
実話データに記載がないという理由だけで、虚偽または捏造と断定してはいけません。
「実話データでは確認できない」と報告してください。

### AMBIGUOUS
記事または実話データの記述が曖昧で、矛盾しているかどうか判断できない。`;

/** 記事内部の整合性検査 */
export const INTERNAL_CONSISTENCY_RULES = `## 記事内部の整合性検査

記事内で、次のような食い違いがないか確認してください。

* 時系列の矛盾
* 同じ数値や回数に関する不一致
* 人物、企業、職種またはサービス名の不一致
* 前半と後半で異なる事実が記載されている
* 結論と体験談の因果関係が成立していない`;

/** 外部検証が必要な記述の特定 */
export const EXTERNAL_VERIFICATION_RULES = `## 外部検証が必要な記述の特定

企業情報、統計、制度、サービス仕様、料金、法律、年月日など、提供された実話データだけでは
正誤を確認できない外部事実を特定してください。外部検索は行わず、
「外部情報による確認が必要」として報告してください。`;

/** 厳守事項 */
export const STRICT_RULES = `# 厳守事項

* 記事全文を書き直さないこと
* 記事の完成版を出力しないこと
* 記事の内容、体験談、数値、出来事を新しく作らないこと
* 実話データに存在しない情報を推測で補完しないこと
* 記載がないことだけを理由に、虚偽または捏造と断定しないこと
* 問題がない箇所を無理に指摘しないこと
* 判断に必要な情報が不足している場合は、推測せずUNSUPPORTEDまたはAMBIGUOUSとすること
* 指定されたJSON Schema以外の文章を出力しないこと`;

/** overall 判定基準 */
export const VERDICT_RULES = `# 判定基準

overall は次の基準で決定してください。

* FAIL:
  - 実話データとの明確な矛盾が1件以上ある
  - または、公開すると重大な事実誤認につながる根拠未確認の体験談・数値・固有名詞がある

* NEEDS_REVIEW:
  - 明確な矛盾はないが、根拠未確認、判定不能、内部不整合、または外部検証が必要な重要記述がある

* PASS:
  - 重大な矛盾、根拠未確認、内部不整合または外部検証事項がない

文章表現上の問題だけが存在する場合、それだけを理由にFAILにしないでください。`;

/** 文体ルール */
export const STYLE_RULES = `# 文体ルール

* です・ます調
* 一人称は「僕」
* 「〜かもしれません」などの逃げ表現を不必要に多用しない
* 各h2セクションは、原則としてPREP法の順序になっている
* 比喩や例え話は、原則として1セクションにつき1つ程度まで

PREP法の適合については、各h2セクションに明確な結論、理由、実体験、結論の再提示が
必要な場合にのみ指摘してください。短いセクションや、役割上PREP法が不自然なセクションを
機械的に問題扱いしないでください。`;

/** QaVerdict の優先度（厳しい方を採用する） */
export function worstVerdict(verdicts: QaVerdict[]): QaVerdict {
  if (verdicts.includes("FAIL")) return "FAIL";
  if (verdicts.includes("NEEDS_REVIEW")) return "NEEDS_REVIEW";
  if (verdicts.includes("WARNING")) return "WARNING";
  return "PASS";
}

/**
 * 「今回の変更が問題を新規発生・悪化させたか」でゲートの判定を決める。
 * 問題が存在するかどうかではない。
 */
export function verdictForOrigin(origin: QaOrigin, severity: QaVerdict): QaVerdict {
  switch (origin) {
    case "INTRODUCED":
    case "REGRESSED":
      return severity;
    case "PRE_EXISTING":
      // 変更前から存在し今回触っていない問題は、報告のみでブロックしない
      return severity === "PASS" ? "PASS" : "WARNING";
    case "UNKNOWN":
      // 帰属不明はFAILにもWARNINGにもせず、人間の確認に回す
      return severity === "FAIL" ? "NEEDS_REVIEW" : severity;
  }
}
