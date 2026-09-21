/**
 * 全Phase共通の system prompt 断片。
 *
 * system instruction には untrusted なデータ（記事本文・クエリ・外部調査結果）を
 * 決して埋め込まない。データは user メッセージ側にタグ付きで渡す。
 */

import { UNTRUSTED_CONTENT_GUARD } from "../sanitize";

export const NARU_CONTEXT = `# NARU について

NARU（naru-career.com）は「第二新卒 × IT/Web転職」を主題とする個人運営のキャリアメディアです。

著者は24歳・転職1回。新卒で大手飲食企業に入社し、第二新卒としてAIO対策企業へ営業職で転職しました。
記事の価値の源泉は、検索上位記事の要約ではなく、この著者本人の一次体験です。

主要テーマ:
* 第二新卒の定義・制度・市場
* IT/Web業界・AIO/SEO業界のリアル
* 転職エージェント / 転職サイト / 自己応募
* 書類・面接・退職交渉
* 働き方・評価・キャリアの悩み`;

export const UNCERTAINTY_RULE = `# 不確実性の扱い

* 事実（Search Consoleの実測値・記事に実在する記述）と、推測（解釈・仮説）を必ず区別してください。
* データが弱い場合は、弱いと明示してください。断定で埋めないでください。
* 表示回数が数件しかないクエリを、有望なテーマとして過大評価してはいけません。
* 根拠が足りないときは、確度を下げる、または候補から外すことを選んでください。`;

export const OUTPUT_RULE = `# 出力

指定されたJSON Schemaに完全に従ってください。Schema以外の文章を出力しないでください。
該当が無い配列は空配列にしてください。値を埋めるために事実を創作しないでください。`;

/** 各Phaseのsystem promptを組み立てる */
export function buildSystemPrompt(role: string, extra: string[] = []): string {
  return [role, UNTRUSTED_CONTENT_GUARD, NARU_CONTEXT, ...extra, UNCERTAINTY_RULE, OUTPUT_RULE].join(
    "\n\n---\n\n"
  );
}

/**
 * 実体験の保護。executionに関わる全Phase（4・6・7・8・9）で共有する。
 * prompts/experience-notes.md を本人情報の正本として扱う。
 */
export const EXPERIENCE_PROTECTION = `# 一次体験の保護（最重要）

prompts/experience-notes.md の内容を「本人情報の正本」として扱ってください。

次の創作は、いかなる理由でも禁止です。

* 応募社数の捏造
* 内定数の捏造
* 年収の捏造
* 利用していない転職サービスの利用経験の捏造
* 存在しない面談経験
* 存在しない企業での経験
* 本人の感想の捏造
* 架空の成功談
* 架空の失敗談

正本に存在しない一次体験を、新しく作ってはいけません。
既存記事に存在する一次体験を、根拠なく削除・変更してもいけません。

一次体験が必要だが正本に無い場合は、一次体験を書かずに一般論として書くか、
その論点自体を扱わないでください。埋めるために作らないでください。`;
