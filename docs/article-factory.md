# 新規記事オートパイロット（Article Factory）

既存の SEO Editor（リライト用）とは**独立した別ドメイン**です。
SEO Editor の署名・QA・publish block・GitHub安全策には一切手を入れていません。

- 実装: `src/lib/article-factory/**`
- API: `src/app/internal/api/article-factory/**`, `src/app/api/cron/article-candidates`
- UI: `/internal/dashboard` の「新規記事」タブ
- CI: `.github/workflows/article-factory-validation.yml`

## 全体の流れ

```
毎日 08:00 JST (cron 0 23 * * * UTC)
  └─ /api/cron/article-candidates  … 候補を3〜5件生成して保存
        ↓
ダッシュボード「新規記事」タブで候補カードを確認
  └─ 「この記事を作る」を押す
        ↓
/internal/api/article-factory/start  … runId を即座に返す
  └─ Vercel Workflow で耐久実行（ブラウザを閉じても継続）
        inventory → cannibalization → research → outline → write
        → internal-links → image-plan → qa → create-pr
        → pr-validation（CI待ち） → publish（マージ） → production-deploy
        ↓
/internal/api/article-factory/status?runId=…  … 進捗を再接続して表示
```

## 必要な環境変数（名前のみ。値はここに書かない）

### 必須

| 変数名 | 用途 |
|---|---|
| `OPENAI_API_KEY` | 候補生成・**実Web検索**・執筆 |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | `/internal/*` の Basic 認証。未設定ならダッシュボードは 503 |
| `SEO_EDITOR_BASE_BRANCH` | PRのベースブランチ。**未設定ならPR作成も候補保存も拒否**する |
| `SEO_EDITOR_GITHUB_TOKEN` または `GITHUB_TOKEN` | PR作成・チェック取得・マージ・候補保存 |
| `CRON_SECRET` | 日次cronの認証。**未設定ならcronは常に401**（fail closed） |

### 任意

| 変数名 | 既定 | 用途 |
|---|---|---|
| `SEO_EDITOR_GITHUB_REPO` | `nasagame8-del/naru-career` | 対象リポジトリ |
| `ARTICLE_FACTORY_MODEL` | `SEO_EDITOR_MODEL` → `gpt-5.5` | 生成・検索モデル |
| `ARTICLE_FACTORY_MODEL_LIGHT` | 上と同じ | 軽量用途（内部リンク） |
| `ARTICLE_FACTORY_BATCH_STORE` | 本番=`github` / 他=`memory` | 保存先の明示指定 |
| `ARTICLE_FACTORY_AUTO_PUBLISH` | （未設定 = 無効） | `true` のときだけ自動公開を許可 |

## 調査フェーズ（実Web検索）

`src/lib/article-factory/research.ts`

1. OpenAI Responses API の **`web_search` ツール**で実際に検索する。
2. 出典として採用できるのは、レスポンスの **`url_citation` アノテーション**で
   返ってきたURLだけ。モデルが本文に書いたURLは採用しない。
   → URLの捏造を構造的に排除している。
3. 検証済みURL一覧だけをモデルに提示し、主張 → 出典 の対応付けを行う。
4. 最終判断は純粋関数 `buildResearchResult()` が行う。
   検証済み集合に無いURLで支えられた時事的主張は `unsupportedClaims` に落ちる。

URLは正規化して比較する（追跡パラメータ・`www.`・末尾スラッシュ・
既定ポート・フラグメント・クエリ順の揺れを吸収）。

**検索が使えない／失敗した／結果ゼロの場合**は、
時事的主張をすべて根拠なしとして残し、QAが公開を止めます（fail closed）。
「構文として正しいURL」は根拠として扱いません。

## 候補バッチの保存先

**本番では GitHub 保存が既定**です。メモリへ暗黙にフォールバックしません。

| 環境 | 既定 | 設定が欠けている場合 |
|---|---|---|
| 本番（`VERCEL_ENV=production`） | GitHub | **503でエラー**（メモリに落ちない） |
| preview / development | メモリ | — |

- 本番で `ARTICLE_FACTORY_BATCH_STORE=memory` を指定しても**拒否**します。
- 本番でトークンやベースブランチが欠けている場合、API は 503 と
  不足している設定名を返し、UI にもそのまま表示されます。
- GitHub 保存先は専用branch `article-factory/candidates` の
  `data/article-candidates/*.json`（master には書きません）。
- 新しい有料DBや追加インテグレーションは導入していません。

## 自動公開の境界

自動公開は**既定で無効**です。以下が**すべて**満たされた場合にのみ公開されます。

1. QAに `FAIL` が1件も無い
2. QAに `NEEDS_REVIEW` が1件も無い
3. QA総合判定が `PASS`
4. 変更パスがすべて許可リスト内
5. **外部CI（`article-factory-validation`）が success**
6. **Vercel Preview チェックが success**
7. サーバー側で `ARTICLE_FACTORY_AUTO_PUBLISH=true`
8. マージ後、**マージコミットの本番デプロイが success**

### 重要な性質

- `buildPassed` はローカルで立てた boolean ではなく、
  **GitHub のcheck-runが success になった事実**を根拠にします。
- `pending` は `pass` ではありません。`sleep()` して再ポーリングします。
- 必須チェックが猶予（3分）を過ぎても現れない場合は `missing` として
  **ブロック**します（合格にしません）。
- チェック待ちは20分でタイムアウトし、タイムアウトも**ブロック**です。
- **マージしただけでは `published: true` にしません。**
  本番デプロイの success を確認して初めて公開完了と報告し、本番URLを返します。
- デプロイが失敗・タイムアウトした場合は blocked を報告し、
  「公開した」とは決して言いません。

### Vercel Git連携について

必須チェックに Vercel Preview を含めているため、
**Vercel の GitHub 連携が未接続だと自動公開は必ず `missing` でブロック**されます。
これは意図した安全側の挙動です。自動公開を使うには Git 連携の接続が必要です。

## 外部CI

`.github/workflows/article-factory-validation.yml`

- トリガー: `content/articles/**` または `data/article-runs/**` を変更するPR
- ジョブ名: `article-factory-validation`（ポーリング側の定数と一致。**テストで固定**）
- 実行: `npm ci` → `npm test` → `npx tsc --noEmit` → `npm run build`
- 権限: `contents: read` のみ。シークレットは使いません。

## 書き込みが許可されるパス

`src/lib/article-factory/safety.ts` の `isAllowedPath()` が唯一の判断基準です。

- `content/articles/<slug>.md`（英小文字・数字・ハイフンのみ）
- `data/article-runs/<name>.json` / `.md`
- `data/article-candidates/<name>.json`

これ以外はすべて拒否します。`..` を含むパス・絶対パスも拒否します。

## 一人称の実体験について

著者として表明してよい一次情報は以下だけです。

- 磯貝アルト、24歳
- 飲食1年 → 第二新卒でIT/Webへ
- 応募約30社、内定2社、年収350→400万円
- 現職はAIO対策企業の法人営業

この範囲を超える一人称の記述は、
`findUnsupportedPersonalClaims()` が機械的に検出して **QAをFAILにします**。
プロンプト側でも明示的に禁止していますが、判断はプロンプトではなくQAが行います。

## 画像

画像は**自動生成しません**。
`data/article-runs/<runId>-image-plan.md` に「どこにどんな画像が要るか」だけを書き出します。
実装してよいのは承認済みの既存画像のみで、既存画像の上書きは行いません。

## テスト

```bash
npm test          # 純粋な安全判定（141件）
npx tsc --noEmit  # 型チェック
npm run build     # ビルド + 生成ルートの確認
```

| ファイル | 件数 | 対象 |
|---|---|---|
| `safety.test.ts` | 51 | QA・パス許可・カニバリ・一人称・cron認証 |
| `checks.test.ts` | 36 | 必須チェック判定・マージゲート・デプロイ判定・CI定義との整合 |
| `research.test.ts` | 28 | URL正規化・重複排除・主張と出典の突き合わせ |
| `storage.test.ts` | 16 | 保存アダプタ・本番での fail closed・冪等なbranch名 |
| `markdown.test.ts` | 10 | frontmatter往復・image-plan |

## 既知の制約

- **GitHub API経路（PR作成・チェック取得・マージ・デプロイ確認）と
  実Web検索は、実APIに対して未検証**。型・判定ロジックは単体で固定済み。
- 自動公開には Vercel の GitHub 連携が必要（未接続なら `missing` でブロック）。
- 調査は `web_search` ツールに依存するため、モデル/アカウントが
  このツールを使えない場合は全件 unsupported となり公開されない。
