# 新規記事オートパイロット（Article Factory）

既存の SEO Editor（リライト用）とは**独立した別ドメイン**です。
SEO Editor の署名・QA・publish block・GitHub安全策には一切手を入れていません。

- 実装: `src/lib/article-factory/**`
- API: `src/app/internal/api/article-factory/**`, `src/app/api/cron/article-candidates`
- UI: `/internal/dashboard` の「新規記事」タブ

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
        → internal-links → image-plan → qa → create-pr → publish
        ↓
/internal/api/article-factory/status?runId=…  … 進捗を再接続して表示
```

## 必要な環境変数（名前のみ。値はここに書かない）

### 必須

| 変数名 | 用途 |
|---|---|
| `OPENAI_API_KEY` | 候補生成・調査・執筆 |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | `/internal/*` の Basic 認証。未設定ならダッシュボードは 503 |
| `SEO_EDITOR_BASE_BRANCH` | PRのベースブランチ。**未設定ならPR作成を拒否**する |
| `SEO_EDITOR_GITHUB_TOKEN` または `GITHUB_TOKEN` | PR作成 |
| `CRON_SECRET` | 日次cronの認証。**未設定ならcronは常に401**（fail closed） |

### 任意

| 変数名 | 既定 | 用途 |
|---|---|---|
| `SEO_EDITOR_GITHUB_REPO` | `nasagame8-del/naru-career` | 対象リポジトリ |
| `ARTICLE_FACTORY_MODEL` | `SEO_EDITOR_MODEL` → `gpt-5.5` | 生成モデル |
| `ARTICLE_FACTORY_MODEL_LIGHT` | 上と同じ | 軽量用途（内部リンク） |
| `ARTICLE_FACTORY_BATCH_STORE` | （未設定 = memory） | `github` にすると候補バッチを永続化する |
| `ARTICLE_FACTORY_AUTO_PUBLISH` | （未設定 = 無効） | `true` のときだけ自動公開を許可 |

## 候補バッチの保存先（重要）

既定は**インメモリ**です。Vercelのサーバーレス実行はインスタンスが使い捨てのため、
**インスタンスが入れ替わると候補バッチは失われます**。

これは仕様であり、UI とAPIレスポンスの `storage.durable: false` と警告文で
そのことを明示しています。永続化しているふりはしません。

本番で翌日まで候補を保持するには、次のどちらかが必要です。

1. `ARTICLE_FACTORY_BATCH_STORE=github` を設定する
   → 新しい外部サービスを増やさず、既に連携済みのGitHubへ保存する。
     専用branch `article-factory/candidates` の
     `data/article-candidates/*.json` に書き込む（master には書かない）。
2. Vercel Blob / Edge Config など新しいストレージを導入する
   → 新規インテグレーションの追加判断が必要。

## 自動公開の境界

自動公開は**このインフラでは既定で無効**です。
以下が**すべて**満たされた場合にのみ公開されます。

1. QAに `FAIL` が1件も無い
2. QAに `NEEDS_REVIEW` が1件も無い
3. QA総合判定が `PASS`
4. 変更パスがすべて許可リスト内
5. サーバー側で `ARTICLE_FACTORY_AUTO_PUBLISH=true` が設定されている

1つでも欠ければ **PRを開いたまま残し、理由を返します**。

現状、QAは build/typecheck を実行できないため必ず `NEEDS_REVIEW` を1件出します。
つまり **現時点では自動公開は構造的に発生しません**。これは意図した保守的な既定です。

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
npm test          # 安全判定の純粋関数（69件）
npx tsc --noEmit  # 型チェック
npm run build     # ビルド + 生成ルートの確認
```

テスト対象は「公開を止められるか」に直結する純粋関数に限定しています。

- 重複/カニバリのブロック
- 許可外の一人称実体験のブロック
- QA FAIL / NEEDS_REVIEW が公開を止めること
- パス許可リスト
- slug上書きの拒否
- cron認証（fail closed を含む）
- 自動公開判定の冪等な境界
- frontmatter形式の往復（gray-matterで既存記事と同じ形になること）

## 既知の制約

- 候補バッチの既定保存先は永続化されない（上記参照）。
- 調査フェーズに外部検索ツールが無いため、モデルは「出典を示せる主張」と
  「示せない主張」を分離するだけで、Web検索は行わない。
  示せない主張は `unsupportedClaims` に入り、QAが公開を止める。
- QAは build/typecheck を実行しないため、常に `NEEDS_REVIEW` が1件出る。
- Vercel の GitHub 連携が未接続のため、作成されたPRにPreviewは付かない。
