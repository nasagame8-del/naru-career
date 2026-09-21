# ChatGPT ↔ Claude Code Handoff

このディレクトリは、NARU開発で人間がChatGPTとClaude Codeの間をコピペし続けないための受け渡し場所です。

## 役割

- `NEXT_INSTRUCTION.md`: ChatGPTが書く。Claude Codeへの次の作業指示。
- `REPORT.md`: Claude Codeが書く。作業結果・未解決事項・判断待ち。
- `STATE.json`: ChatGPTが管理する受け渡し状態。Claude Codeは原則変更しない。
- `HISTORY/`: 重要な節目で過去の指示・報告を残す場所。

## Single-writer rule

競合を避けるため、担当を固定します。

- ChatGPT: `NEXT_INSTRUCTION.md`, `STATE.json`
- Claude Code: `REPORT.md`
- 人間: 原則編集しない

## Claude Codeの開始手順

1. `docs/agent-handoff/NEXT_INSTRUCTION.md` を読む。
2. `instructionId` を確認する。
3. `REPORT.md` の `completedInstructionId` と同じなら再実行しない。
4. 指示された範囲だけ作業する。
5. 判断が必要なら推測で進めず停止する。
6. 完了時に `REPORT.md` を更新する。

## ChatGPTの開始手順

ユーザーが「Claudeの最新報告見て」「続きやって」などと依頼したら:

1. GitHubの `work` ブランチから `REPORT.md` を読む。
2. 必要なら関連diff・コード・ブランチ状態を直接確認する。
3. 次の判断を行う。
4. `NEXT_INSTRUCTION.md` を更新する。
5. `STATE.json` のinstructionId/statusを更新する。
6. ユーザーにはコピペを要求せず、次にClaude Codeで `NEXT_INSTRUCTION.md` を読ませればよい状態にする。

## 安全ルール

- `main` / `master` への直接pushは禁止。
- PR作成、merge、production deployは指示に明記された場合のみ。
- 不明点を推測して破壊的変更しない。
- secretsやtokenをREPORTへ書かない。
- 大きな方針変更は `NEEDS_DECISION` として停止する。
- 既存のSEO Editorの署名・QA・GitHub安全策を迂回しない。

## REPORTの最低項目

- reportId
- completedInstructionId
- status: DONE | NEEDS_DECISION | BLOCKED | FAILED
- branch
- commit / working tree state
- 実施内容
- テスト結果
- 変更ファイル
- 既知の問題
- 判断が必要な項目
- 次に推奨する作業

この仕組みの目的は「人間を承認者に戻す」ことであり、無人で本番変更を走らせることではありません。
