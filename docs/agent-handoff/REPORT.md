# Claude Code Report

- reportId: `REPORT-004`
- completedInstructionId: `INST-004`
- status: `PR_READY`
- branch: `agent/new-article-autopilot`
- baseBranch: `master`
- pr: `#15`
- verifiedAt: `2026-09-23`
- environment: Node v20.20.2 / npm 10.8.2

## Summary

独立レビューで指摘された本番クリティカルな4つのギャップをすべて実装した。
いずれも REPORT-003 で自分が「残るリスク」として挙げたものであり、指摘は妥当。

| # | ギャップ | 対応 |
|---|---|---|
| A | 調査が実検索でなく、URL構文しか検証していなかった | `web_search` ツールによる実検索 + 引用アノテーション限定の出典採用 |
| B | 候補保存が既定で非永続だった | 本番はGitHub保存が既定。設定不足は503でfail closed |
| C | `buildPassed: null` 固定で必ず NEEDS_REVIEW になっていた | 外部CI + Vercel Previewのcheck-runを耐久ポーリングして根拠にする |
| D | 自動公開が構造的に起こり得なかった / 公開確認が無かった | CIゲート通過後にマージ、**本番デプロイ成功を確認してから**公開と報告 |

既存の安全ゲートは1つも弱めていない。むしろ公開条件は厳しくなった
（QA単独 → QA + 外部CI + Vercel Preview + 本番デプロイ確認）。

`npm ci` / `npm test`（141件）/ `tsc --noEmit` / `npm run build` すべて通過。
lint は REPORT-002 のベースラインと完全一致（新規0件）。

## A. 実Web検索による調査

新規 `src/lib/article-factory/research.ts`（484行）。
旧実装（`generation.ts` 内の102行）は削除した。

### SDK APIの確認（推測で書いていない）

インストール済みの型定義を直接読んで確認した。

- `node_modules/openai/package.json` → `openai@6.46.0`
- `responses.d.ts:6884` → `WebSearchTool.type: 'web_search' | 'web_search_2025_08_26'`
- `responses.d.ts:5113` → `ResponseOutputText.URLCitation { title, url, start_index, end_index }`
- `responses.d.ts:5077` → `ResponseOutputText.annotations[]`
- `responses.d.ts:3068` → `include: 'web_search_call.action.sources'`

### 捏造を構造的に排除する設計

1. Responses API を `tools: [{ type: "web_search" }]` で呼び、実際に検索する。
2. **出典として採用するのは `url_citation` アノテーションのURLだけ。**
   モデルが本文中に書いたURLは一切採用しない。
3. 検証済みURL一覧だけをモデルに提示し、主張→出典を対応付けさせる。
4. 最終判断は純粋関数 `buildResearchResult()`。
   検証済み集合に無いURLで支えられた時事的主張は `unsupportedClaims` へ落ちる。

つまり **モデルがURLを思い出して書いても根拠にならない**。
「構文として正しいURL」は証拠として扱わない、という指摘に直接対応している。

### URL正規化

`normalizeSourceUrl()` が以下を吸収して比較可能な正規形にする。

- http/https 以外を拒否（`ftp:` / `javascript:` / `data:` も）
- ホスト小文字化・先頭 `www.` 除去
- 追跡パラメータ除去（utm_* / gclid / fbclid / yclid / msclkid / ref / spm ほか）
- クエリのキー順ソート・空になった `?` の除去
- フラグメント除去・末尾スラッシュ除去（ルートは保持）
- 既定ポート（80/443）の除去

一次情報判定 `isAuthoritativeUrl()` は go.jp / lg.jp / ac.jp / gov / edu /
e-stat / mhlw / iso.org / w3.org などを対象にし、
`go.jp.evil.com` のようなサフィックス偽装を弾くことをテストで確認している。

### 検索が使えない場合（fail closed）

- `OPENAI_API_KEY` 未設定・API失敗 → 例外にせず `unsupportedClaims` に理由を残す
- 引用が0件 → 「出典を創作しないため根拠なしとして扱う」と明記して返す
- 主張の対応付けに失敗 → 同様に unsupported

いずれもQAが `sources` カテゴリで FAIL を出して公開を止める。
一人称実体験の制限は一切変更していない。

## B. 本番での永続保存（fail closed）

`getCandidateBatchStore()` を書き換えた。

| 環境 | 既定 | 設定不足時 |
|---|---|---|
| 本番（`VERCEL_ENV=production`、無ければ `NODE_ENV`） | **GitHub** | `StorageUnavailableError` |
| preview / development | memory | — |

- **本番でメモリへ暗黙にフォールバックしない。**
- 本番で `ARTICLE_FACTORY_BATCH_STORE=memory` を明示しても**拒否**する。
- 3つのAPIルート（candidates / start / cron）はこの例外を捕まえて
  **503 + 不足している設定名**を返す。UIはその理由を改行付きで表示する。
- `durable` の申告と `describeStore()` は維持。
- 新しい有料DB・追加インテグレーションは導入していない。

秘密の値は返さない。返すのは env の**名前**だけ。

## C. 記事PRの実検証ゲート

### GitHub Actions ワークフロー（新規）

`.github/workflows/article-factory-validation.yml`

- トリガー: `content/articles/**` / `data/article-runs/**` を変更するPR
- ジョブ名: `article-factory-validation`（安定・明示）
- 実行: `npm ci` → `npm test` → `npx tsc --noEmit` → `npm run build`
- 権限: `contents: read` のみ。シークレット不使用。`persist-credentials: false`

INST-004 がこのファイルの追加を明示的に許可していたため追加した。
`naru-agent-autopilot.yml` には触っていない。

### 耐久ポーリング

`checks.ts`（純粋関数）+ `workflow.ts` のステップで実装。

ワークフローはPR作成後に:

1. `getPullRequestState()` で **PR head SHA** を取得
2. `getChecksForSha()` で check-runs と commit statuses の**両方**を取得・正規化
   （Vercelはcommit statusで報告される場合があるため）
3. `evaluateRequiredChecks()` で判定
4. `pending` の間は `sleep("30s")` して再ポーリング（**ワークフロー側でsleep**）
5. `passed` になって初めて `buildPassed: true` でQAを再評価

判定の性質（すべてテストで固定）:

- `queued` / `in_progress` は **pending**（passにしない）
- `failure` / `cancelled` / `timed_out` / `action_required` / `stale` は **failed**
- `neutral` / `skipped` も **成功として扱わない**
- 猶予3分を過ぎても現れない必須チェックは **missing → ブロック**
- 20分で **timeout → ブロック**
- 失敗は pending より優先

必須チェックは2つ:
`article-factory-validation`（完全一致）と Vercel（`/vercel/i` で表記揺れを吸収）。

**ジョブ名と定数の結合はテストで固定**している
（ずれると「チェックが永遠に現れない」= 自動公開が静かに止まるため）。

Workflow DevKit の使い方も指示どおり:
オーケストレーションと `sleep()` は `"use workflow"`、
GitHub APIポーリングは `"use step"`、境界はプレーンJSONのみ。

## D. 安全な自動公開と本番確認

### マージ

`evaluateMergeGate()` が QA と CI の**両方**を要求する。

- QAがNG → マージしない
- チェックが pending → マージしない（retryable）
- failed / missing / timeout → マージしない（retryable でない）
- **既にマージ済み → 再マージしない（冪等）**

`ARTICLE_FACTORY_AUTO_PUBLISH` は明示的な許可フラグとして維持。
OFF のときは検証済みPRを**開いたまま残す**。

`mergeArticlePullRequest()` は **マージコミットSHAを返す**ように変更した。
既にマージ済みなら既存のマージコミットSHAを返す（冪等）。

### 本番デプロイ確認

マージ後、`getDeploymentStatusesForSha(mergeCommitSha)` を
`sleep("30s")` 間隔でポーリングし、`evaluateDeployment()` で判定する。

- `production` 環境を優先。無ければ全体で判定
- 失敗は成功より優先
- デプロイ未登録・進行中は **pending**（成功にしない）
- 20分で **timeout**

**`published: true` と本番URLを返すのは、デプロイ success を確認できた場合のみ。**
失敗・タイムアウト時は `published: false` のまま blocked を報告し、
「PRはマージ済み」という事実だけを添える。**公開完了とは決して言わない。**

`PublishResult` に `headSha` / `mergeCommitSha` を追加した。

## E. UI・状態

フェーズを10→12に拡張した。

```
inventory → cannibalization → research → outline → write
→ internal-links → image-plan → qa → create-pr
→ pr-validation → publish → production-deploy
```

ラベル: 在庫確認 / 重複チェック / 調査中 / 構成作成 / 執筆 / 内部リンク /
画像プラン / QA / PR作成 / **PR検証（CI）** / **公開（マージ）** / **本番デプロイ**

- CI待ち・デプロイ待ちの間も `running` として理由付きメッセージを流す
- ブロック時は `CHECKS_MISSING` / `CHECKS_TIMEOUT` / `DEPLOY_FAILED` などの
  コード付きで正確な理由を表示
- 保存先503の理由（不足env名）を改行付きで表示
- リロード後の再接続は従来どおり `startIndex=0` でストリームを読み直す

## テスト結果

```
npm ci            → exit 0
npm test          → 5 files / 141 tests passed (exit 0)
npx tsc --noEmit  → exit 0
npm run build     → exit 0
```

| ファイル | 件数 | 増減 |
|---|---|---|
| `safety.test.ts` | 51 | ±0 |
| `checks.test.ts` | 36 | **+36（新規）** |
| `research.test.ts` | 28 | **+28（新規）** |
| `storage.test.ts` | 16 | +8 |
| `markdown.test.ts` | 10 | ±0 |
| **合計** | **141** | **+72** |

INST-004 が要求した項目の対応:

| 要求 | テスト |
|---|---|
| research normalization | `normalizeSourceUrl` 9件 + `isAuthoritativeUrl` 4件 |
| source/claim mapping | `buildResearchResult` 10件 |
| duplicate URLs | `dedupeSources` 4件 |
| invalid URLs | 正規化3件 + 重複排除1件 |
| no-result behavior | 検索不可・引用0件・検証済み空 の3件 |
| production storage cannot silently use memory | `getCandidateBatchStore` 8件 |
| required check pending/success/failure/missing/timeout | `evaluateRequiredChecks` 15件 |
| merge impossible before checks pass | `evaluateMergeGate` 7件 |
| production URL not before deployment success | `evaluateDeployment` 11件 |
| idempotent replay (PR exists / already merged) | マージゲート冪等1件 + `branchNameForRun` 3件 |

追加で、CIワークフローのジョブ名・トリガーパス・権限が
コード側の定数と一致することを3件のテストで固定した。

### lint

```
npx eslint  →  66 errors, 14 warnings（計80件 / 29ファイル）
```

**REPORT-002 のベースラインと完全一致。新規0件。**
新規・変更ファイルのみを対象にした lint は `exit 0`（指摘0件）。

### ワークフローYAML検証

`js-yaml` でパースして構造を確認した。

```
article-factory-validation.yml => VALID YAML
  name: Article Factory Validation
  job: article-factory-validation -> name: article-factory-validation (6 steps)
  permissions: {"contents":"read"}
  on: {"pull_request":{"paths":["content/articles/**","data/article-runs/**"]}}
naru-agent-autopilot.yml => VALID YAML（変更なし）
```

### ビルド後のルート確認

```
workflows build complete (19 steps, 1 workflow, time 72ms)   ← 15→19（新規4step）
ƒ /.well-known/workflow/v1/flow
ƒ /.well-known/workflow/v1/step
ƒ /.well-known/workflow/v1/webhook/[token]
ƒ /api/cron/article-candidates
ƒ /internal/api/article-factory/candidates
ƒ /internal/api/article-factory/start
ƒ /internal/api/article-factory/status
```

## 実装中に見つけて対処した問題

1. **js-yaml のバージョン差異**
   テストで使うため devDependency に追加したところ v5.4.2 が入り、
   v5 は**デフォルトエクスポートを持たない**ため `yaml.load` が失敗した。
   名前付き `load` に変更して解決。
   また v5 は自前の型定義を同梱するため、誤って入れた `@types/js-yaml@4` は削除した。

2. **`NODE_ENV` が型上 readonly**
   本番判定のテストで代入できず `tsc` が失敗した。
   テスト内で可変ビュー経由に変更して解決。

3. **`PublishResult` の必須フィールド追加漏れ**
   `headSha` / `mergeCommitSha` を追加した際、`github.ts` の
   冪等パスと新規作成パスの返り値が追随しておらず `tsc` が検出。修正済み。

## 変更ファイル

新規:

```
.github/workflows/article-factory-validation.yml
src/lib/article-factory/research.ts        (484行)
src/lib/article-factory/research.test.ts   (289行)
src/lib/article-factory/checks.ts          (新規・純粋判定)
src/lib/article-factory/checks.test.ts     (新規)
```

変更:

```
src/lib/article-factory/workflow.ts        401→642行（CIゲート・デプロイ確認）
src/lib/article-factory/github.ts          401→531行（PR状態・チェック・デプロイ・マージSHA）
src/lib/article-factory/storage.ts         本番fail closed
src/lib/article-factory/storage.test.ts    +8件
src/lib/article-factory/types.ts           フェーズ12化・PublishResult拡張
src/lib/article-factory/config.ts          WAIT（ポーリング間隔・タイムアウト）
src/lib/article-factory/generation.ts      旧research削除（387→285行）
src/app/internal/api/article-factory/{candidates,start}/route.ts   503対応
src/app/api/cron/article-candidates/route.ts                      503対応
src/app/internal/dashboard/article-factory/NewArticleTab.tsx      理由表示
package.json / package-lock.json           js-yaml (devDep)
docs/article-factory.md                    全面更新
docs/agent-handoff/REPORT.md               本レポート
```

変更していないもの:

- `src/lib/seo-editor/**` — `git status` で無変更を確認
- `content/**` の記事 — 1文字も変更していない
- `docs/agent-handoff/STATE.json` / `NEXT_INSTRUCTION.md`
- `.github/workflows/naru-agent-autopilot.yml`
- 未コミットの下書き（`content/note-drafts/**`、`note-drafts/**`、
  `public/images/articles/*.png`）— ステージングしていない

## 既知の問題・残るリスク

### 1. 実APIに対する検証は未実施（最大の残リスク）

以下は**実際のAPIに対して実行していない**。
INST-004 が「実記事を作らない / PR #15 をマージしない」を境界としており、
実行にはトークンと実際の書き込みが伴うため。

- OpenAI `web_search` ツールの実呼び出し
- GitHub: PR作成・check-runs取得・マージ・Deployments取得

型・正規化・判定ロジックは141件のテストで固定しているが、
**APIレスポンスの実形状との突き合わせは初回実行時に必要**。
特に Vercel の check 名・commit status の出方は実地確認が要る。

### 2. 自動公開には Vercel Git連携の接続が必須

必須チェックに Vercel Preview を含めたため、
**Git連携が未接続だと必ず `missing` でブロックされる**。
これは安全側の意図した挙動だが、自動公開を使うには接続が前提になる。
接続しない運用を選ぶ場合は `REQUIRED_CHECKS` の見直しが必要（product判断）。

### 3. `web_search` ツールの利用可否

モデル・アカウントが `web_search` を使えない場合、
出典が0件になり全件 unsupported となって公開されない。
安全側だが、その場合は記事が一切公開されないことになる。
初回実行で「引用が実際に返ってくるか」の確認が必要。

### 4. 記事IDはリポジトリ在庫からの提案値

NARUの記事Markdownに数値IDが無いため `在庫数+1` を提案値として返す。
Drive側に別のID体系がある場合はそちらが正本（REPORT-003から継続）。

### 5. 既存lint 80件

内訳は REPORT-002 と同じ（61件は `scripts/*.js` のCommonJS）。今回も新規0件。

## 判断が必要な項目

**ブロッカーとしての判断事項はない。**

将来的な判断事項:

1. Vercel Git連携を接続するか（接続しないなら自動公開は使えない）
2. `ARTICLE_FACTORY_AUTO_PUBLISH=true` をいつ有効化するか
3. `web_search` が使えない場合の代替（別の検索経路を足すか、手動調査に倒すか）

## 推奨する次の作業

1. PR #15 をレビューする（マージは指示どおり行っていない）。
2. Vercel に `CRON_SECRET` を設定する。
3. Vercel の GitHub 連携を接続する（自動公開を使う場合は必須）。
4. **手動で候補生成を1回**実行し、次を実地確認する:
   - 本番でGitHub保存が選ばれること（設定不足なら503が出ること）
   - `web_search` が実際に `url_citation` を返すこと
5. 候補を1件選んで実行し、PR作成 → `article-factory-validation` の発火 →
   チェック待ちの挙動を確認する
   （`ARTICLE_FACTORY_AUTO_PUBLISH` は未設定のままなのでマージはされない）。
6. 実地確認で判明したAPIレスポンスの差異があれば次の指示として起票する。

master への push・マージ・本番デプロイは**実施していない**。
PR #15 のマージも**実施していない**。実記事の生成・公開も**実施していない**。
