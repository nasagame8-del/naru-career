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

- OpenAI API: Slack War Roomの司会・Claude後レビューに限り、低コストモデルを小さいtoken上限で使用する
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


## Slack War Room

Slackの `#naru-war-room` は、優貴・ChatGPT・Claude Code・Observerの会議ログを集約する表示面です。

Slack上の表示主体は3つの専用Appに分離します。

- `NARU ChatGPT`: 要件整理、レビュー、次の判断を投稿
- `NARU Claude Code`: 実装開始・完了・PR/Actions情報を投稿
- `NARU Observer`: 異常時だけ停止理由を投稿

Repository secrets:

- `SLACK_CHATGPT_WEBHOOK_URL`
- `SLACK_CLAUDE_WEBHOOK_URL`
- `SLACK_OBSERVER_WEBHOOK_URL`

Webhook URL自体はコード、REPORT、issue、Slack本文へ書かない。

### ChatGPT relay

`.github/workflows/naru-war-room-relay.yml` は、repository owner がGitHub issue/PRへ次の形式でコメントした場合だけ、対応するSlack App名義で投稿する。

```
@naru-war-room chatgpt <message>
@naru-war-room claude <message>
@naru-war-room observer <message>
```

これは表示用relayであり、Slackの投稿だけを契機にChatGPTモデルを自動起動するものではない。OpenAI APIを使わない方針を維持するため、ChatGPTの判断はChatGPTセッション側で行い、必要な会議発言だけrelayする。

### Claude notifications

`naru-agent-autopilot.yml` はClaude実行の開始・正常終了を `NARU Claude Code` 名義でSlackへ通知する。Slack通知失敗だけでClaudeの実装を止めない。

### Observer

ObserverはLLMではなく決定論的な安全ゲートとして動作する。Claude実行に失敗・timeout・guard違反があった場合、自動継続を行わず `NARU Observer` 名義で警告する。

現行guard:

- Claude最大8ターン
- workflow timeout 15分
- autonomous iterationは最大2
- 同じinstructionIdの二重実行を拒否
- Claudeによる `STATE.json` / `NEXT_INSTRUCTION.md` / workflow変更を拒否
- Claudeの未commit差分が25ファイルを超えたら拒否
- OpenAI/Anthropic API keyや代表的な従量API endpoint/secret patternの新規追加を拒否
- guard失敗時はClaude差分をcommit/pushしない
- master直接push、Claudeからの自動merge、production deployは許可しない

Observerは通常会話へ参加せず、異常時だけ発言する。


## Live Slack meeting ingress

Slackの `#naru-war-room` から `NARU ChatGPT` をメンションすると、`POST /api/slack/events` がSlack Events APIを受ける。

### Runtime secrets

Vercel:

- `OPENAI_API_KEY`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHATGPT_BOT_TOKEN`
- `WAR_ROOM_GOOGLE_CREDENTIALS`（任意。Google Driveを読む場合のread-only service account JSON。raw JSONまたはbase64）
- GitHub delegate用: `WAR_ROOM_GITHUB_TOKEN` または既存の `SEO_EDITOR_GITHUB_TOKEN` / `GITHUB_TOKEN`

GitHub Actions:

- `OPENAI_API_KEY`
- 既存の `CLAUDE_CODE_OAUTH_TOKEN`
- 既存のSlack webhook secrets

Optional:

- `WAR_ROOM_OPENAI_MODEL`（default: `gpt-6-luna`）
- `SLACK_WAR_ROOM_CHANNEL_ID`（default: `C0C71TPTSHW`）
- `WAR_ROOM_GITHUB_REPO`（default: `nasagame8-del/naru-career`）

### Slack App settings

`NARU ChatGPT` App:

- Bot Token Scope: `app_mentions:read`
- Bot Token Scope: `chat:write`
- Bot Token Scope: `channels:history`
- Event Subscriptions Request URL: `https://naru-career.com/api/slack/events`
- Subscribe to bot events: `app_mention`

Slack署名はraw body + timestampで検証し、5分を超えたrequestとSlack retryは再処理しない。

### Discussion flow

1. 優貴がSlackでNARU ChatGPTをメンション。
2. War Roomは同じSlackスレッドの直近20件（最大8,000文字）を読み、会話文脈を共有する。
3. 発言内にGoogle Driveのfile/folder URLがあれば、read-only service accountで資料を取得し、最大14,000文字の共有文脈にする。
4. GPT-6 Lunaが current message + thread context + Drive context を読み、`answer / delegate / human` を判定。
5. `delegate` の場合、Slack event IDごとの専用branch + Draft PRを作り、同じ共有文脈をClaudeのinstructionへ渡す。
6. ClaudeはChatGPT案を反論・検証し、REPORTに `## Slack reply` を書く。workflowがその本文をClaude名義で元スレッドへ返す。
7. Claude完了後、低コストChatGPT reviewがREPORT/diffを読み、同じSlackスレッドへ返す。明確な修正だけ最大1回Claudeへ戻す。
8. Observerは実装差分を監視するが、REPORT内の単なるAPI名・環境変数名では誤停止しない。
9. merge / production deployは自動実行しない。

OpenAI側は `reasoning: none`, 小さいoutput上限, `store: false`,外部ツールなしで利用量を抑える。


## Google Drive read bridge

War RoomからprivateなGoogle Drive資料を読む場合、ChatGPT製品側の接続権限はVercelへ自動継承されないため、専用のread-only service accountを使う。

1. Google Cloudでservice accountを1つ作成し、Google Drive APIを有効化する。
2. service account key JSONを作成する。
3. 読ませたいNARUのDrive root（または必要なフォルダだけ）を、そのservice accountの `client_email` に「閲覧者」で共有する。
4. Vercel Production/PreviewのSecret `WAR_ROOM_GOOGLE_CREDENTIALS` にJSON全体を保存する。raw JSONでもbase64でもよい。
5. 再デプロイする。

War RoomはDrive URLがSlack発言に含まれる時だけDriveへアクセスする。フォルダは直下の一覧と最近更新された子フォルダを限定サンプルし、Google Docs / Sheets / text / Markdown / JSON / CSVを読み取る。画像やPDFなど非テキスト型は現時点では本文抽出せず、ファイル名と型だけ共有する。

取得したDrive本文はSlackの現在の依頼と同じ一時コンテキストにだけ入れ、repositoryへ恒久保存しない。
