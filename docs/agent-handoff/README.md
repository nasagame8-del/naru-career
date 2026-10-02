# ChatGPT ↔ Claude Code Cloud Bridge

このディレクトリは、NARU開発でChatGPTを司令塔、Claude Codeを実装ワーカーとして使うクラウド連携用です。
人間がChatGPTとClaudeの間で長文をコピペする運用は前提にしません。

## 役割

- ChatGPT: 要件整理、Drive/GitHub/Vercelの現状確認、指示作成、diffレビュー、次工程判断
- Claude Code: コード調査、実装、必要なテスト、REPORT更新
- GitHub: 共有状態、PR、実行ログ、Actionsの実行基盤
- Vercel: Preview / Production確認
- 人間: 仕様・公開・見た目など本当に判断が必要な箇所だけ確認

## Control plane

タスクごとに専用ブランチとDraft PRを使います。

- ChatGPT owns: `STATE.json`, `NEXT_INSTRUCTION.md`
- Claude Code owns: `REPORT.md` と、その指示で必要な実装ファイル
- Workflow: `.github/workflows/naru-agent-autopilot.yml`
- Authentication: GitHub repository secret `CLAUDE_CODE_OAUTH_TOKEN`
- Trigger: 対象PRのコメント `@naru-autopilot <instructionId>`

GitHub ActionsはPRのheadブランチをcheckoutし、STATEとコメントのinstructionIdが一致した場合だけClaudeを起動します。

## API / cost policy

従量API課金は原則0です。

- OpenAI API: 使用しない
- Anthropic API key: 使用しない
- Claude Code: `CLAUDE_CODE_OAUTH_TOKEN` のサブスクリプション認証だけを使う
- 外部の有料検索・生成API: 使用しない
- GitHub Actions / Shell / Node / Python / 既存CIなど、LLM不要の処理を先に使う
- ChatGPTだけで判断・GitHub操作できる作業ではClaudeを起動しない
- Claudeが必要な場合も、明示トリガーされた1タスクだけ実行する

GitHub ActionsのClaude Codeログにドル換算の利用量が表示される場合がありますが、この運用ではAPI keyを渡さずOAuthトークンのみを使用します。サブスクリプション利用枠そのものは消費し得るため、以下の上限も設けます。

## Cost / usage guard

Claude同士を無制限に会話させません。

- workflowの `maxClaudeTurns`: 8（固定上限）
- 1タスクの自律ラウンド: 原則2回まで
- ChatGPTレビューで問題がなければ2回目は実行しない
- 同じinstructionIdは二重実行しない
- 通常のlint/build/grep/画像変換など、LLM不要な処理はスクリプトやCIを優先する
- Claude実行が失敗した場合、部分変更は自動commitしない

過去に100ターン設定で長時間実行したため、workflowは8ターンで強制終了します。タスク自体を小さく分割し、同じinstructionIdの二重実行はgateで止めます。

## State machine

```
IDLE
  ↓ ChatGPTが具体的なinstructionを作る
RUN_CLAUDE
  ↓ PRコメントで明示トリガー
WAITING_FOR_CHATGPT
  ↓ ChatGPTがREPORTとdiffを監査
  ├─ 完了 → PR_READY / HUMAN_REQUIRED
  └─ 修正必要 → 新しいinstructionIdでRUN_CLAUDE（原則1回だけ）
```

自動でClaude→Claude→Claudeと再帰実行はしません。

## Starting a task

1. ChatGPTが最新masterから専用ブランチを作る。
2. 必要ならDraft PRを作る。
3. `STATE.json` に一意な `instructionId`, `status: RUN_CLAUDE` を設定する。`maxClaudeTurns` は記録用で、実行上限はworkflow側の8ターンを優先する。
4. `NEXT_INSTRUCTION.md` に目的、変更範囲、完了条件、テスト、禁止事項を書く。
5. 対象PRへ `@naru-autopilot <instructionId>` とコメントする。
6. GitHub ActionsがClaude Codeをクラウド実行する。
7. Claudeは `REPORT.md` と必要な実装を更新し、workflowが同じPR branchへcommit/pushする。
8. ChatGPTがREPORT、diff、CIを確認し、終了または1回だけ追加修正を出す。

## Remote visibility

PCを起動しておく必要はありません。スマホからGitHubの対象PRとActionsを見るだけで、

- 実行中 / 成功 / 失敗
- Claudeが変更したcommit
- REPORTの結論
- CI結果
- Vercel Preview

を追えます。workflow完了時には対象PRへ実行結果の短いサマリーコメントも残します。

## Automatic stop conditions

以下では自動継続せず、人間またはChatGPTの判断へ戻します。

- 最大ラウンド到達
- 同じblockerが繰り返す
- secret / credential入力が必要
- masterへのmergeまたはproduction deployが必要
- 破壊的なmigration / deletion
- 根拠不足の不可逆なコンテンツ・事業判断
- NARUの公開QA、安全ゲート、プレビュー承認を迂回する必要が生じた場合

## Safety

- masterへの直接push禁止
- 記事PRはNARUの既存公開フローを優先
- secrets/tokenをREPORTやcommitへ書かない
- Claudeは `STATE.json` / `NEXT_INSTRUCTION.md` を変更しない
- ChatGPTはClaudeのREPORTを盲目的に採用せず、実diffとテスト結果を確認する
- ユーザー承認が必要な公開・画像・プレビュー判断は自動化しない
