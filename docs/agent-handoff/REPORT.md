# Claude Code Report

## REPORT-006 — Article Factory API cost controls

- reportId: `REPORT-006`
- completedInstructionId: `USER-COST-CONTROL-2026-09-23`
- status: `PR_READY`
- baseBranch: `master`
- baseCommit: `7dd6b545924f810f0b3704a426d5ab246f259ebd`
- API generation calls during implementation: **0**

### Summary

- `gpt-5.5` は本文執筆だけに限定した。
- 候補生成・Web調査・主張マッピング・構成・内部リンク・出典修復は、既定で `gpt-5-mini` を使う。
- `ARTICLE_FACTORY_MODEL_LIGHT` と `ARTICLE_FACTORY_MODEL_RESEARCH` で個別に上書き可能。
- `no credits remaining` / `insufficient_quota` / billing hard limit / API key不正は `FatalError` とし、Workflowの無駄な再試行を止めた。
- Structured OutputsとWeb検索の各呼び出しについて、本文・prompt・secretを含めず、モデル名とtoken数だけを `[openai-usage]` としてVercel Logsへ出す。
- QA、安全ゲート、自動公開フラグ、記事本文は変更していない。

### Verification

| 項目 | 結果 |
|---|---|
| 新規モデル/エラー方針テスト | 13 passed |
| 全テスト | 218 passed / 0 failed |
| `npx tsc --noEmit` | exit 0 |
| article-factory + OpenAI wrapper lint | exit 0 |
| `npm run build` | exit 0、22 steps / 1 workflow、108ページ |
| flow bundle | `process.env` / `openai` / Node builtin すべて0 |
| `content/articles/**` | 差分0 |

### Remaining risk

- 実APIを使う成功パスは、OpenAI APIクレジット追加後にのみ確認できる。
- 料金のドル換算は価格改定があるためコードへ固定せず、token数を観測可能にした。次回1記事の実測後に上限値を決める。

---

- reportId: `REPORT-005`
- completedInstructionId: `INST-004-REVIEW-FIX`（REPORT-004後の独立レビュー指摘3点。ユーザーからの直接指示。NEXT_INSTRUCTION.md の INST-004 は REPORT-004 で完了済みのため二重実行ではない）
- status: `PR_READY`
- branch: `agent/new-article-autopilot`
- baseBranch: `master`
- pr: `#15`
- reviewedHead: `76a1892`
- fixCommit: `c626919e04c42512c9349ccb4ac96e7b77af01f7`（このREPORTはその直後のコミットで追加）
- verifiedAt: `2026-09-22`
- environment: Node v20 / npm 10 / workflow@4.8.9 / next 16.2.10

## Summary

| # | 指摘 | 対応 | 結果 |
|---|---|---|---|
| 1 | `"use workflow"` 内で `isAutoPublishAuthorized()` が `process.env` を読む | `stepIsAutoPublishAuthorized()`（`"use step"`）へ移動。純粋定数を `constants.ts` に分離 | 生成 flow バンドルの `process` 参照 **6件 → 0件** |
| 2 | 再実行前の古い failure/pending が最新 success より優先される | 同一チェックごとに日時→IDで最新を明示選択。Vercel の match を発行元+正確な context に限定 | 回帰テスト追加 |
| 3 | デプロイ履歴を平坦化し古い failure で失敗扱い / Preview success を本番成功扱い | 最新 production deployment の最新 status のみで判定。Preview フォールバック削除 | 回帰テスト追加 |

安全ゲートは弱めていない。変更はいずれも「誤ブロックを解消」または「誤合格を防止」の方向で、後者（Vercel matchの厳格化・Previewフォールバック削除・検証ジョブの発行元限定）はゲートを**強化**している。

## 1. Workflow 本体から環境変数を排除

### インストール済みドキュメントの確認

- `node_modules/workflow/docs/api-reference/workflow-globals.mdx`:
  workflow 関数は Node.js VM 内で動く。`process.env` は「開始時点の凍結スナップショット」としては読めるが、
  Node.js コアモジュール・グローバル `fetch`・タイマー・`Buffer` は使用不可。`Date.now()` / `new Date()` は論理時計で決定的。
- `docs/how-it-works/code-transform.mdx`: workflow コードは flow バンドルに文字列として埋め込まれ VM で実行、
  step 本体は step バンドル側に置かれ workflow 側ではスタブ化される。

`process.env` はドキュメント上は読めるが、指示どおり workflow 本体は step から受け取った値だけを使う構造にした。

### 変更

- `src/lib/article-factory/constants.ts`（新規）: `SITE_URL` / `ARTICLE_RUN_DIR` / `WAIT` / `TOPIC_SCOPE` / `LIMITS` など
  **リテラルのみ・import なし・process なし**の定数。
- `config.ts`: 上記を再exportして既存の import 経路を維持。env 依存の値（モデル名・GitHub repo/base branch・自動公開フラグ）だけが残る。
- `safety.ts`: `./config` → `./constants`（`canAutoPublish` が workflow 本体から直接呼ばれるため）。
- `workflow.ts`: `stepIsAutoPublishAuthorized()` を追加し、workflow 本体は返された boolean だけを `canAutoPublish()` に渡す。

### 生成結果での監査（`npm run build` 後の `src/app/.well-known/workflow/v1/flow/route.js`）

| 項目 | 修正前 | 修正後 |
|---|---|---|
| `process.env.*` 参照 | 6（ARTICLE_FACTORY_AUTO_PUBLISH / _MODEL / _MODEL_LIGHT / SEO_EDITOR_MODEL / _GITHUB_REPO / _BASE_BRANCH） | **0** |
| `process` トークン（ファイル全体） | — | **0** |
| 同梱される article-factory モジュール | config / markdown / safety / workflow | **constants** / markdown / safety / workflow |
| `require(` / `Buffer` / `fetch(` / `node:` / `setTimeout` / openai / api.github.com | — | すべて 0 |

- `SITE_URL`・`WAIT`・`ARTICLE_RUN_DIR` は `constants.ts` のリテラルで、実行環境で値が変わらないため workflow 本体で使用して安全と判断（バンドル内でもリテラルとして埋め込まれていることを確認）。
- workflow 本体から直接呼ぶ通常関数 `phaseEvent` / `buildArticleMarkdown`（markdown.ts）/ `canAutoPublish`（safety.ts）も process・Node API・外部API参照なし。`new Date()` はドキュメント上決定的。
- step バンドルに **16 step**（新規 `stepIsAutoPublishAuthorized` を含む）、flow バンドルに `newArticleWorkflow` が登録されていることを確認。

## 2. CIチェック再実行時の古い結果を無視

### 実APIで利用できるフィールド（実装で使用）

- Check Runs（`GET /commits/{sha}/check-runs?filter=all`）: `id`, `name`, `status`, `conclusion`, `started_at`, `completed_at`, `app.slug`
  - API既定の `filter=latest` に依存せず全試行を取得し、自前で最新を選ぶ。
- Commit Statuses（`GET /commits/{sha}/statuses`）: `id`, `context`, `state`, `created_at`, `creator.login`
  - combined status（`/status`）は `creator` を含まないため、全履歴の `/statuses` に変更。

### PR #15 の実データで確認した Vercel の形

- commit status: `context: "Vercel"`, target_url が vercel.com のデプロイ（Preview の実結果）
- check-run: `"Vercel Preview Comments"`（コメント機能。デプロイ結果ではない）

旧実装の `/vercel/i` では **"Vercel Preview Comments" の success だけで Vercel Preview 合格になり得た**（実在する誤合格経路）。

### 判定ルール（`checks.ts`）

- `latestPerCheck()`: (出どころ, 発行元, 名前) ごとに最新1件だけ残す。
  `compareRecency()` は両方の日時が有効で異なれば日時、同時刻・日時不明なら ID（単調増加）で比較。配列順には依存しない。
- Vercel Preview: `isVercelDeploymentCheckName()`（`Vercel` または `Vercel – <project>`）かつ
  commit status の `creator.login === "vercel[bot]"` または check-run の `app.slug === "vercel"`。
- article-factory-validation: **GitHub Actions（`app.slug === "github-actions"`）の check-run のみ**。同名の commit status では合格しない。
- 同じ必須チェックに check-run と commit status の両方が該当する場合は、**両方の最新が success** の場合のみ合格（競合時は安全側）。
- 両方の必須チェックが最新状態で success のときだけ `passed`。

## 3. 本番デプロイの古い失敗履歴を無視

- `getDeploymentStatusesForSha()` は平坦化をやめ、deployment ごとに `{ id, environment, createdAt, statuses[{ id, state, createdAt, environmentUrl }] }` を返す。
- `evaluateDeployment()`:
  1. `isProductionEnvironment()`（trim + 大文字小文字無視、`Production – <project>` も可）で production のみ抽出
  2. 最新 deployment を created_at → ID で選択
  3. その最新 status を created_at → ID で選択
  4. `success` → succeeded（URL返却）/ `failure`・`error` → failed / `inactive` → failed（置き換え済みで確認不可）/ status 未登録・pending・queued・in_progress → pending（期限超過で timeout）
- **旧実装の「production が無ければ全環境で判定」フォールバックを削除**（Preview success が本番成功になっていた）。
- `published: true` と本番URLは workflow 上 `deploy.state === "succeeded"` の分岐でのみ返る（既存構造のまま、判定元が上記に変わった）。

## テスト結果

| コマンド | 結果 |
|---|---|
| `npm ci` | 成功 |
| `npm test` | **169 passed / 0 failed**（5 files）。REPORT-004 時点 141 → +28 |
| `npx tsc --noEmit` | エラー 0 |
| `npm run build` | 成功（exit 0）。workflow/step 正常認識 |
| `npx eslint src/lib/article-factory/` | 0 problems |
| `npm run lint`（全体） | 81 problems — `76a1892` と完全一致（既存分のみ、article-factory 内 0） |
| YAML（js-yaml） | `article-factory-validation.yml` / `naru-agent-autopilot.yml` とも OK |
| `content/articles/**` の差分 | 0 行 |
| secrets/token パターン | 差分に該当なし |

### 追加した回帰テスト（checks.test.ts）

CI:
古いfailure→最新success / 古いcancelled→最新success / 古いpending→最新success / 古いsuccess→最新failure /
古いsuccess→最新pending / rerun（開始時刻未設定の新試行をIDで最新判定）/ 同時刻はID優先 /
配列順（正順・逆順・シャッフル）非依存 / check-run+status 重複（両方success→passed）/
競合（片方failure→failed、片方pending→pending）/ 片方の必須チェックだけ最新failure /
名前に vercel を含むだけ（"Vercel Preview Comments", "vercel[bot]", "my-vercel-lint", "not-vercel", "Vercel Preview"）/
Vercel以外の発行元が立てた "Vercel" / 検証ジョブ名の commit status・他App check-run / `latestPerCheck` / `isVercelDeploymentCheckName`

Deploy:
古いfailure→最新production success / 古いsuccess→最新production failure / 古いsuccess→最新production pending /
Preview success + Production pending / Preview success のみ（pending・timeoutとも成功にしない）/
同一deployment内の古いfailure+最新success / 同一deployment内の古いsuccess+最新failure /
deployment・status 順不同（3通りの並び）/ 同時刻deploymentはID優先 / status未登録 / inactive / environment 大文字小文字・`Production – <project>`

### 仕様変更に伴い期待値を更新した既存テスト（削除はしていない）

旧テストのうち4件は、今回修正対象の**誤った挙動そのもの**を固定していたため期待値を更新した。

1. 「Vercelのcheck名の揺れを吸収する」— `"Vercel Preview Comments"` / `"vercel[bot]"` を合格としていた → 正しい context のみ合格、それ以外は不一致を検証する2件に分割
2. 「同名チェックが複数あり片方が失敗」— 名前 `"Vercel Preview"` に依存 → 実在形式 `"Vercel – <project>"` 2件で再構成
3. 「失敗は成功より優先される（同一コミットに両方）」— 順序非依存の新テスト群（同一deployment内の最新判定）に置換
4. 「production が無ければ全体で判定する」（Preview success → succeeded）— **Preview success は本番成功にしない（pending）**へ反転

## 変更ファイル

- `src/lib/article-factory/constants.ts`（新規）
- `src/lib/article-factory/config.ts`
- `src/lib/article-factory/safety.ts`（import元のみ）
- `src/lib/article-factory/workflow.ts`
- `src/lib/article-factory/checks.ts`
- `src/lib/article-factory/github.ts`
- `src/lib/article-factory/checks.test.ts`
- `docs/agent-handoff/REPORT.md`

## git diff 概要

`76a1892..c626919`: 7 files。`checks.ts` の型を `CheckSummary{source,id,name,origin,observedAt,...}` /
`DeploymentRecord{id,environment,createdAt,statuses[]}` に拡張し、最新選択ロジックを追加。
`github.ts` は取得エンドポイントとフィールドのみ変更（書き込み系・マージ系は無変更）。
`NEXT_INSTRUCTION.md` / `STATE.json` / 既存記事は無変更。

## 既知の問題・残るリスク

1. **Vercel の発行元識別子は実APIレスポンスの完全な確認ができていない**。PR #15 の combined status では context `"Vercel"` を確認したが、
   combined API は `creator` を返さないため `creator.login === "vercel[bot]"` は Vercel の既知の仕様に基づく。
   もし実際の login が異なれば Vercel Preview が `missing` になり**自動公開がブロックされる（fail closed）**。誤合格の方向には倒れない。
2. **本番 Deployment の environment 名**は `Production` / `Production – <project>` を想定。Vercel が別名を使う場合は
   本番デプロイが見つからず `timeout`（公開と報告しない）になる。こちらも fail closed。
3. `inactive` を最新 status とする production deployment は `failed` 扱い（従来は pending→timeout）。
   別コミットの本番デプロイに置き換えられた場合、当該記事が本番に含まれていても「公開確認できず」と報告する（安全側）。
4. check-run と commit status で Vercel が別結果を出す場合、両方 success まで合格しない（安全側。誤ブロックの可能性はある）。
5. ページングは check-runs / statuses / deployments とも 100 件まで。同一SHAでこれを超える再実行は想定外（超えた場合は古い結果の欠落となり、最新は通常先頭ページに含まれる）。
6. 実記事生成・本番デプロイ・`ARTICLE_FACTORY_AUTO_PUBLISH` の有効化は行っていないため、エンドツーエンドの実環境検証は未実施。

## 判断が必要な項目

- なし（上記リスク1・2は、自動公開を有効化する前に一度 `/commits/{sha}/statuses` と `/deployments` の実レスポンスで
  `creator.login` と `environment` を確認することを推奨）。

## 推奨する次の作業

1. PR #15 の人間レビュー（マージは行っていない）
2. 自動公開を有効化する前に、実レスポンスで Vercel の `creator.login` / deployment `environment` を確認
3. 1記事分の dry-run（AUTO_PUBLISH 無効のまま）で PR 作成 → CI 待機 → `publishBlockedReason` までの経路を確認

## 実施していないこと（禁止事項の遵守）

PR #15 のマージ / master への push / 本番デプロイ / 実記事生成 / `ARTICLE_FACTORY_AUTO_PUBLISH` の有効化 /
既存記事の変更 / secret の表示・保存・コミット — いずれも行っていない。
