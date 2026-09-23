# Claude Code Report

- reportId: `REPORT-006`
- completedInstructionId: `PROD-VERIFY-ARTICLE-FACTORY`（ユーザー直接指示：本番実地確認）
- status: `BLOCKED`
- blockerKey: `EGRESS_DENIED_NARU_CAREER_COM`
- branch: `claude/pr15-independent-review-fixes-4fxah2`（REPORTのみ。master には push していない）
- productionSha: `ee89c28618196f8778e12455911df528e40f871d`

## 結論

本番APIを呼べなかったため、候補生成以降は**1つも実行していない**。

- 実行環境（Claude Code クラウドコンテナ）から `https://naru-career.com` への接続は、ネットワークポリシーで拒否された
  （egress proxy が CONNECT を 403 で拒否。`/` と `/internal/api/article-factory/candidates` の両方）。
- このコンテナには Vercel CLI も gh CLI も無い。`DASHBOARD_USER` / `DASHBOARD_PASSWORD` も無いので、Basic 認証も通せない。

| 項目 | 結果 |
|---|---|
| 候補生成 | 未実施（到達不可） |
| GitHub永続保存 | 未実施 |
| 選択候補 / runId | なし |
| research / 記事PR / validation / Vercel Preview | 未実施 |
| 自動マージ・本番公開 | **行っていない**（記事PRも作成していない） |
| 保存済み候補の変更 / env の変更 | 行っていない |
| 一時ファイル | 作成していない（env pull 未実施） |

### 本番環境変数の事前確認

未実施。Vercel コネクタの env 一覧 API は plain 型の変数値もレスポンスに含めるため、
「値を出力しない」条件を保証できないと判断して呼び出さなかった。
このため `ARTICLE_FACTORY_AUTO_PUBLISH` が true でないことも未確認。

## 実APIで判明したレスポンス形式（GitHub API・読み取りのみ）

本番マージコミット `ee89c28` と PR #15 head `ccdd16e` の実レスポンス。

| 項目 | 実レスポンス | Workflow の matcher | 一致 |
|---|---|---|---|
| Vercel commit status | context `Vercel`、creator.login `vercel[bot]`。pending→success の2件（id 昇順・時刻順） | `isVercelDeploymentCheckName` + `vercel[bot]` | ✅ |
| Vercel check-run | name `Vercel Preview Comments`、app.slug `vercel`（再実行で2件） | 名前が不一致のため除外 | ✅ 誤認しない |
| Production deployment | environment `Production`、original_environment `Production`、**production_environment は `false`** | `isProductionEnvironment`（名前で判定し、フラグは不使用） | ✅ |
| Deployment status | state `success`、environment `Production`、environment_url あり | 最新 status の success のみ | ✅ |
| 他の environment 名 | `Preview` / `Production` | Preview は除外 | ✅ |

`production_environment` フラグは実データで `false` だった。このフラグで本番を判定していたら、本番デプロイを検出できなかった。

## 再開に必要なこと

次のどちらかが必要。

1. このクラウド環境の Network access で `naru-career.com` への通信を許可する。あわせて、Basic 認証情報を安全に使える経路を用意する（例: 環境の secret として設定）。
2. 手元の端末（Vercel/gh CLI ログイン済み）で同じ手順を実行する。

## 推奨する次の作業

- 上記の到達性を用意してから本番実地確認を再実行する。
- 開始前に Vercel ダッシュボードで `ARTICLE_FACTORY_AUTO_PUBLISH` が未設定であることを確認する。
