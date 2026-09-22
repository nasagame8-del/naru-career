# Claude Code Report

- reportId: `REPORT-003`
- completedInstructionId: `INST-003`
- status: `PR_READY`
- branch: `agent/new-article-autopilot`
- baseBranch: `master`
- verifiedAt: `2026-09-23`
- environment: Node v20.20.2 / npm 10.8.2

## Summary

新規記事オートパイロット（Article Factory）のインフラを実装し、検証を完了した。

- SEO Editor とは完全に独立した別ドメイン（`src/lib/article-factory/**`）として実装。
  SEO Editor のファイルは**1つも変更していない**。
- 耐久実行は Vercel Workflow DevKit（`workflow@4.8.9`）。
  ビルド時に **1 workflow / 15 steps** として認識されていることを確認済み。
- 安全判定は純粋関数に切り出し、**69件のユニットテスト**で固定した。
- 指示どおり、実記事の生成・公開は行っていない。

lint / build / typecheck / test すべて通過。新規lintエラー0件。
人間のレビューに進める状態と判断し `PR_READY` とする。

## 実施した検証

### 1. ハンドオフ状態の確認

- `STATE.json`: `status: RUN_CLAUDE` / `instructionId: INST-003` / `mode: NEW_ARTICLE_AUTOPILOT` を確認。
- `REPORT.md` は `REPORT-002` / `INST-002` のままだった（= INST-003 は未実行）。二重実行なし。
- `AGENTS.md` の Ownership に従い、`STATE.json` と `NEXT_INSTRUCTION.md` は変更していない。
- `.github/workflows/**` も今回の指示どおり一切触っていない。

### 2. 既存実装の調査（実装前）

実装方針を決めるため、先に以下を読んだ。

- 既存記事37本のfrontmatter形式（実際に使われているキーを全件集計）
  → 必須キー: `title` `category` `keyword` `datePublished` `dateModified`
    `excerpt` `summary` `faq` `cta_agents` `note_published`（37本すべてが保持）
  → 任意キー: `naruPoint`(10) `inlineFaq`(7) `widgets`(3) ほか
  → カテゴリは3種のみ: 業界解説(17) / 体験談(17) / エージェント比較(3)
- `src/lib/seo-editor/` の再利用可能な部分（`corpus` / `openai` / `auth` / `config` / `github`）
- `src/middleware.ts` の Basic 認証の適用範囲
- `node_modules/workflow/docs/**`（Next.js統合・`getRun`・`getWorkflowMetadata`）

**記事IDについて**: NARUの記事Markdownには数値IDのfrontmatterが存在しない
（`grep -l "^id:" content/articles/*.md` → 0件）。
`data/articles-status.json` にもID体系は無い。
そのため `computeNextArticleId()` は**リポジトリ在庫の本数+1**を提案値として返す実装にした。
Drive側に別のID体系がある場合はそちらが正本であり、この値は突き合わせ用。
この前提はコード内コメントとPR本文にも明記している。

## 実装内容

### 1. 独立ドメイン（`src/lib/article-factory/`）

| ファイル | 行数 | 役割 |
|---|---|---|
| `types.ts` | 289 | 全型定義（候補バッチ/候補/選択トピック/フェーズ/出典/ドラフト/QA/公開結果） |
| `config.ts` | 140 | 設定・上限・許可ペルソナ事実・スコープ境界・自動公開フラグ |
| `safety.ts` | 618 | **純粋関数のみの安全判定**（後述） |
| `inventory.ts` | 66 | 記事在庫の読み出し・次の記事ID |
| `candidates.ts` | 200 | 候補生成（LLM）＋機械判定 |
| `generation.ts` | 387 | 調査 → 構成 → 執筆 → 内部リンク |
| `markdown.ts` | 124 | frontmatterシリアライズ・image-plan生成 |
| `github.ts` | 401 | branch → commit → PR。冪等・上書き拒否・パス許可リスト |
| `storage.ts` | 162 | 候補バッチ保存アダプタ（memory / github） |
| `workflow.ts` | 401 | `"use workflow"` オーケストレーション + `"use step"` × 15 |

`phase4-action.ts` は経由していない。SEO Editor のコードは読み取り専用で再利用のみ。

### 2. 候補生成

- 在庫（既存記事37本）を必ず読んでから候補を出す。
- 3〜5件（`LIMITS.minCandidates` / `maxCandidates`）。
- 各候補に title / primaryKeyword / searchIntent / differenceFromExisting /
  reasonToWriteNow / riskFlags を持たせる。
- **LLMの自己申告は信用しない**。返ってきた候補は必ず `validateCandidate()` を通し、
  重複・スコープ外・slug不正を機械的に判定して `blocked` を確定させる。
- **Search Console のデータは使っていない**。`searchEvidence` は常に `null` で、
  検索ボリュームや順位を推測で埋めていない。その旨を `batch.notes` に明記して返す。

### 3. 耐久実行（Vercel Workflow）

- `next.config.ts` を `withWorkflow()` でラップ。
- `"use workflow"` はオーケストレーションのみ。Node/OpenAI/GitHub は全て `"use step"` 側。
- `start()` は runId を即座に返す → **ブラウザを閉じても実行継続**。
- runId は `getWorkflowMetadata().workflowRunId` から取得し、PRのbranch名に使う
  （同一runIdなら同一branch = 冪等）。
- 境界を越えるのはプレーンJSONのみ。
- エラー分類:
  - `FatalError` … 設定不備・スキーマ不一致・GitHub 4xx（リトライ無意味）
  - `RetryableError` … rate limit / timeout / 5xx（`retryAfter` 付き）
- フェーズ順序は指示どおり10段階:
  `inventory → cannibalization → research → outline → write →
   internal-links → image-plan → qa → create-pr → publish`

ビルド時に `workflows build complete (15 steps, 1 workflow)` と表示され、
`/.well-known/workflow/v1/{flow,step,webhook/[token]}` が登録されることを確認。

**middlewareとの干渉なし**: `src/middleware.ts` の matcher は
`["/internal/:path*", "/members/:path*"]` のみで、`.well-known/workflow/*` を
インターセプトしない。Workflow SDKのドキュメントが警告している問題は発生しない。

### 4. API ルート

| ルート | 認証 | 役割 |
|---|---|---|
| `GET /internal/api/article-factory/candidates` | Basic + ルート側再検証 | 最新バッチ取得 |
| `POST /internal/api/article-factory/candidates` | 同上 | 手動生成 |
| `POST /internal/api/article-factory/start` | 同上 | 実行開始 → runId即返し |
| `GET /internal/api/article-factory/status` | 同上 | 進捗NDJSONストリーム / `mode=meta` |
| `GET /api/cron/article-candidates` | `Bearer CRON_SECRET` | 日次候補生成 |

**cronを `/internal` 配下に置かなかった理由**: `/internal/*` は Basic 認証で保護されており、
Vercel Cron は Basic 認証情報を送れない。そのため独立した Bearer 認証で保護している。

`status` は `workflow/api` の `getRun()` / `getReadable({startIndex})` を使用。
`startIndex=0` で読み直せるため、**ページをリロードしても現在のフェーズを復元できる**。

### 5. 安全ゲート（すべて `safety.ts` の純粋関数）

公開をブロックする条件（`runQa`）:

| カテゴリ | 判定 |
|---|---|
| slug形式不正 / 既存slug衝突 | FAIL |
| スコープ外（第二新卒×IT/Web転職から外れる） | FAIL |
| カニバリゼーション（Jaccard類似度 ≥ 0.7 または slug一致） | FAIL |
| frontmatter欠落・形式不正 | FAIL |
| 実在しない内部リンク | FAIL |
| 許可外の一人称実体験 | FAIL |
| 時事的主張の出典欠落 | FAIL |
| 許可外の書き込みパス | FAIL |
| build/typecheck失敗 | FAIL |
| 本文が短すぎる / build未実行 | NEEDS_REVIEW |

GitHub書き込み側の独立したガード:

- 新規branchを毎回作成（`article-factory/<runId>`）
- 許可パス以外は `ArticleGithubError` で拒否（QA通過後にも**再検証**）
- **既存記事slugの上書きを拒否**（ベースブランチにファイルが存在したら409）
- master への直接pushは実装していない（PR作成のみ）
- 同runIdで既にPRがあればそれを返す（冪等）
- Token はエラーメッセージにもレスポンスにも出さない

### 6. 自動公開の境界（既定OFF）

`canAutoPublish()` は以下**すべて**を満たす時だけ `allowed: true` を返す。

1. QA に FAIL が0件
2. QA に NEEDS_REVIEW が0件
3. QA総合判定が PASS
4. `ARTICLE_FACTORY_AUTO_PUBLISH=true` がサーバー側に設定されている

**重要**: 現状QAは build/typecheck を実行しないため必ず NEEDS_REVIEW を1件出す。
つまり**現時点で自動公開は構造的に発生しない**。これは意図した保守的な既定。
条件を満たさない場合はPRを開いたまま残し、理由を返す。

### 7. 一人称実体験の禁止

許可された一次情報（磯貝アルト/24歳/飲食1年/第二新卒でIT・Web/応募約30社/内定2社/
年収350→400万円/AIO対策企業の法人営業）**以外**の一人称記述は、
`findUnsupportedPersonalClaims()` が文単位で機械検出し、QAをFAILにする。

プロンプト側でも明示的に禁止しているが、**判断はプロンプトではなくQAが行う**。

### 8. 画像

画像は生成しない。`data/article-runs/<runId>-image-plan.md` に
Drive互換の計画（位置・用途・推奨サイズ・状態）だけを書き出す。
「承認済みの既存画像のみ実装可」「既存画像を上書きしない」を本文に明記。

### 9. Cron設定

`vercel.json` — `"fluid": true` を維持したうえで cron を1件だけ追加。

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "fluid": true,
  "crons": [{ "path": "/api/cron/article-candidates", "schedule": "0 23 * * *" }]
}
```

`0 23 * * *` UTC = 08:00 JST。エントリは1件のみ。

### 10. ダッシュボードUI

`/internal/dashboard` に **「新規記事」タブ**を追加（`performance` の次、`SEO Editor` の前）。
既存の「SEO Editor」タブはラベル・機能とも変更していない。

表示内容:

- 候補カード（title / keyword / 検索意図 / 既存との差分 / いま書く理由 / riskFlags / slug）
- `この記事を作る` ボタン（blocked な候補は無効化し理由を表示）
- 10フェーズの進捗（待機/実行中/完了/失敗/スキップ）＋日本語ラベル
- runId の表示
- **リロード後の再接続**（runIdをlocalStorageに保持し、`startIndex=0` で読み直す）
- 停止理由（コード付き）
- PR URL / 本番URL

## テスト結果

### ユニットテスト（新規導入）

```
npm test  →  3 files / 69 tests passed (exit 0)
```

テストランナーは `vitest@3.2.7` を devDependency として追加。
`package.json` に `test` / `test:watch` を追加した。

| ファイル | 件数 | 対象 |
|---|---|---|
| `safety.test.ts` | 51 | 安全判定の純粋関数 |
| `markdown.test.ts` | 10 | frontmatter往復・image-plan |
| `storage.test.ts` | 8 | 保存アダプタ・記事ID・branch名 |

INST-003 が最低限要求した項目の対応:

| 要求項目 | テスト |
|---|---|
| duplicate/cannibalization blocks | `checkCannibalization` 4件 + `runQa` 1件 + `validateCandidate` 1件 |
| unsupported personal-experience blocks | `findUnsupportedPersonalClaims` 3件 + `runQa` 1件 |
| QA FAIL / NEEDS_REVIEW block publication | `canAutoPublish` 5件 |
| path allowlist | `isAllowedPath` 6件 + `runQa` 1件 |
| slug overwrite refusal | `refusesSlugOverwrite` 1件 + `runQa` 1件 |
| cron auth | `isValidCronAuth` 5件（未設定時のfail closedを含む） |
| idempotent publish decision | `branchNameForRun` 3件 + `canAutoPublish` の境界 |

追加で、**生成した記事Markdownがサイト本体と同じパーサ（gray-matter）で
既存記事と同じ形として読めること**を往復テストで固定した。

### テストで発見・修正した実装バグ（1件）

`branchNameForRun()` のサニタイザが `.` を許可しており、
runIdに `..` が含まれると branch 名に `..` が残っていた。
git の ref 名は `..` を含められないため、PR作成が失敗する経路だった。
英数字・アンダースコア・ハイフン以外をすべてハイフンに畳むよう修正し、テストで固定。

### typecheck

```
npx tsc --noEmit  →  exit 0（エラー0件）
```

### build

```
npm run build  →  exit 0
workflows build complete (15 steps, 1 workflow, time 68ms)
108ページ生成成功
```

ビルド後のルートテーブルで新規ルートの登録を確認:

```
ƒ /.well-known/workflow/v1/flow
ƒ /.well-known/workflow/v1/step
ƒ /.well-known/workflow/v1/webhook/[token]
ƒ /api/cron/article-candidates
ƒ /internal/api/article-factory/candidates
ƒ /internal/api/article-factory/start
ƒ /internal/api/article-factory/status
```

### lint

```
npx eslint  →  66 errors, 14 warnings（計80件 / 29ファイル）
```

**REPORT-002 時点のベースラインと完全一致。新規0件。**
新規ファイルのみを対象にした lint も `exit 0`（指摘0件）。

補足: Workflow SDK がビルド時に生成する `src/app/.well-known/**` に
`no-unused-vars` 警告が1件出たため、`eslint.config.mjs` の `globalIgnores` に
同ディレクトリを追加した。生成物でありSDKが自前の `.gitignore` で
git管理からも除外しているため、lint対象から外すのが妥当と判断した。

### 依存関係

```
npm ci  →  exit 0（lockfileどおり）
```

- 追加: `workflow@^4.8.9`（dependencies）、`vitest@^3.2.7`（devDependencies）
- `npm audit` の既存警告あり（`workflow` の依存ツリーを含む）。今回は未対応。

## 変更ファイル

新規:

```
src/lib/article-factory/{types,config,safety,inventory,candidates,
                         generation,markdown,github,storage,workflow}.ts
src/lib/article-factory/{safety,markdown,storage}.test.ts
src/app/internal/api/article-factory/{candidates,start,status}/route.ts
src/app/api/cron/article-candidates/route.ts
src/app/internal/dashboard/article-factory/NewArticleTab.tsx
vitest.config.ts
docs/article-factory.md
```

変更:

```
next.config.ts                                  withWorkflow() でラップ
vercel.json                                     cron追加（fluid: true は維持）
package.json / package-lock.json                workflow / vitest / testスクリプト
eslint.config.mjs                               生成物ディレクトリを ignore
.gitignore                                       /.swc（Workflow SDKが追記）
src/app/internal/dashboard/DashboardClient.tsx  新規記事タブの追加（3行）
docs/agent-handoff/REPORT.md                    本レポート
```

新規コード合計 約4,360行（うちテスト722行）。

意図的に変更していないもの:

- `src/lib/seo-editor/**`、`src/app/internal/api/seo-editor/**`、
  `src/app/internal/dashboard/seo/**` — `git status` で無変更を確認
- `content/**` の記事 — 1文字も変更していない
- `docs/agent-handoff/STATE.json` / `NEXT_INSTRUCTION.md` — ChatGPT管理
- `.github/workflows/**` — 今回の指示で対象外
- 作業ツリーに元からあった未コミットの下書き
  （`content/note-drafts/**`、`note-drafts/**`、`public/images/articles/*.png`）
  — コンテンツエージェント管轄のため保護。ステージングしていない。

## 必要な環境変数（名前のみ）

必須: `OPENAI_API_KEY` / `DASHBOARD_USER` / `DASHBOARD_PASSWORD` /
`SEO_EDITOR_BASE_BRANCH` / `SEO_EDITOR_GITHUB_TOKEN`（または `GITHUB_TOKEN`）/ `CRON_SECRET`

任意: `SEO_EDITOR_GITHUB_REPO` / `ARTICLE_FACTORY_MODEL` /
`ARTICLE_FACTORY_MODEL_LIGHT` / `ARTICLE_FACTORY_BATCH_STORE` /
`ARTICLE_FACTORY_AUTO_PUBLISH`

値は一切このレポートにもコードにも含めていない。
ソース内のハードコード鍵パターン走査: 0件。

## 既知の問題・残るリスク

### 1. 候補バッチの既定保存先は永続化されない

Vercelのサーバーレス実行はインスタンスが使い捨てのため、
既定の `MemoryCandidateBatchStore` は**インスタンス入れ替えで失われる**。

指示に従い、これを「永続化されているふり」にはしていない。

- `describeStore()` が `durable: false` と警告文を返す
- APIレスポンスに `storage` として含まれる
- ダッシュボードに警告バナーとして表示される
- テストでも「永続化されないことを申告する」ことを固定している

**新しい有料サービスを追加せずに済む durable な経路も実装済み**:
`ARTICLE_FACTORY_BATCH_STORE=github` を設定すると、既に連携済みのGitHubへ保存する
（専用branch `article-factory/candidates`、master には書かない）。

このため `NEEDS_DECISION` には**していない**。ただし次項の通り未検証。

### 2. GitHub経路が実APIに対して未検証

`GithubCandidateBatchStore` と `createArticlePullRequest()` は、
実際のGitHub APIに対して実行していない。
今回の指示が「実記事を作らない」インフラPRであり、
実行にはトークンとリポジトリへの書き込みが伴うため。

型・パス検証・冪等性のロジックは単体で確認済みだが、
**実APIとの往復は初回実行時に検証が必要**。

### 3. QAはbuild/typecheckを実行しない

生成記事を追加した状態でのbuildを実行できないため、
`stepQa` は `buildPassed: null` を渡し、QAは必ず NEEDS_REVIEW を1件出す。

結果として自動公開は構造的に発生しない（安全側）。
自動公開を実際に機能させるには、QA内でbuild/typecheckを回す仕組みが別途必要。

### 4. 調査フェーズに外部検索がない

モデルに検索ツールを与えていないため、`runResearch` は
「出典を示せる主張」と「示せない主張」を分離するだけで、Web検索は行わない。
示せない主張は `unsupportedClaims` に入り、QAが公開を止める。
URLとして壊れた出典も機械的に降格させる。

時事性の高い記事を実用するには、検索ツール連携の追加が望ましい。

### 5. Vercel GitHub連携が未接続（既存の制約）

作成されたPRにVercel Previewが自動生成されない。REPORT-002 から継続。

### 6. `agent/autopilot` 側のワークフロー問題は未解決（参考）

REPORT-002 で報告した `.github/workflows/naru-agent-autopilot.yml` の
`git add -A` + `workflows` 権限欠如によるpush失敗は、今回の指示範囲外のため未着手。
なお `origin/master` には `fix/autopilot-safe-staging`（#13）が入っており、
既に対処済みの可能性がある（本ブランチでは未確認）。

## 判断が必要な項目

**ブロッカーとしての判断事項はない。**

将来的に判断が必要になりうるもの（いますぐではない）:

1. 候補バッチの永続化方式
   - a) `ARTICLE_FACTORY_BATCH_STORE=github`（追加コストなし・実装済み・未検証）
   - b) Vercel Blob / Edge Config の導入（新規インテグレーションの判断が必要）
2. 自動公開を実際に有効化するか
   （有効化にはQA内build/typecheckの実装 + `ARTICLE_FACTORY_AUTO_PUBLISH=true` の両方が必要）
3. 調査フェーズへの検索ツール導入

## 推奨する次の作業

1. **PR をレビューする**（このブランチはまだPR未作成。作成は指示に従い行っていない）。
2. Vercel に `CRON_SECRET` を設定する（未設定ならcronは常に401で安全側に倒れる）。
3. `ARTICLE_FACTORY_BATCH_STORE=github` を設定し、
   まず**手動生成**（ダッシュボードの「候補を生成」）で
   GitHub保存経路を1回だけ実地検証する。
4. 候補を1件選んで実行し、PRが作られるところまでを実地確認する
   （自動公開は既定OFFなのでマージはされない）。
5. 問題がなければ日次cronの初回発火（08:00 JST）を確認する。
6. 必要に応じてQA内のbuild/typecheck実装を次の指示として起票する。

master への push・マージ・本番デプロイは**実施していない**。
実記事の生成・公開も**実施していない**。
