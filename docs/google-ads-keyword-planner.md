# Google Ads Keyword Planner 連携

NARUの記事候補選定で、Google Ads APIの `KeywordPlanIdeaService.GenerateKeywordIdeas` を使い、
検索需要（平均月間検索数・競合度・月別推移）を取得するための設定メモ。

## 2026-10時点の重要事項

- 2026-09-09以降、新規Google Ads API利用では旧来のMCC「APIセンター」でdeveloper tokenを申請する方式ではなく、Google Cloud project側の **Google Ads API Overview** でaccess levelを管理する。
- APIを有効化した直後はTest access。
- production Google Ads accountで `KeywordPlanIdeaService` を使うには **Basic access以上** が必要。Explorer accessではPlanning系サービスが制限される。
- Basic access申請にはGoogle Cloud projectのbrand verificationが前提。
- Google Ads API自体の呼び出し料金は無料。
- 認証はNARU既存のSearch Console用サービスアカウントを再利用可能。

## Google側の設定

1. NARUで使うGoogle Cloud projectを選択。
2. APIs & Services → Library → **Google Ads API** → Enable。
3. Google Ads API Overviewを開き、access levelを確認。
4. productionのKeyword Plannerデータが必要ならBasic accessまで申請。
5. IAM & Admin → Service Accountsで、既存のNARUサービスアカウントを確認（なければ作成）。
6. Google Ads → 管理者 → アクセスとセキュリティ → ユーザー → ＋ から、サービスアカウントのメールアドレスを追加。
7. Google AdsのCustomer ID（10桁）を控える。

## NARU側の環境変数

Search Consoleで既に使っている次の2つは再利用する。

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

追加:

```
GOOGLE_ADS_CUSTOMER_ID=1234567890
# MCC配下のclient accountを使う場合のみ
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
# 通常は不要。旧移行環境だけ必要なら設定
GOOGLE_ADS_DEVELOPER_TOKEN=
# 省略時 v25
GOOGLE_ADS_API_VERSION=v25
```

## 実行

```bash
npm run data:keyword-demand
```

個別キーワード:

```bash
npm run data:keyword-demand -- --keywords "第二新卒 転職,未経験 IT 転職,転職エージェント 第二新卒"
```

出力は `data/private/keyword-demand.json`。
このファイルには検索ボリュームの生値を含むため、公開Gitにはコミットしない。

## NARU候補選定での使い方

朝の候補選定は次の順で見る。

1. GSC `data/seo-opportunities.json` — 既に表示されている検索クエリ・リライト機会。
2. Keyword Planner private snapshot — 市場全体の検索需要。
3. 既存記事とのカニバリ判定。
4. 一次情報・時事性・NARUのテーマ適合。
5. 新規記事より既存記事改善の期待値が高ければ、リライトを優先。

検索ボリュームだけで記事化を決めない。
