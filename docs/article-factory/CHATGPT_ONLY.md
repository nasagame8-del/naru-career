# NARU新規記事 — ChatGPTのみ・別途OpenAI API課金なし

**対象**: NARU新規記事の「候補・調査・構成・本文・内部リンク・出典修復」。OpenAI API と GPT Work は使わない。
GitHubとDriveは既存の接続済みアプリで操作する。GitHub ActionsとCloudflareの既存デプロイ経路を使う。

## 課金防止の実装
- `POST /internal/api/article-factory/start` は認証後 410。旧ワークフロー起動・再実行を禁止。
- `POST /internal/api/article-factory/candidates` は認証後 410。保存済み候補の `GET` は継続。
- `GET /api/cron/article-candidates` はCron認証後 410。さらに `vercel.json` から毎朝08:00の旧Cronを削除。
- ダッシュボードの「候補を生成」は「保存済み候補を更新」に変更し、「この記事を作る」は「候補をコピー」に変更。旧POSTを呼ばない。
- 旧 `research.ts` / `generation.ts` のOpenAI呼び出し実装は、履歴・過去ワークフローの参照のため残すが、上記のHTTP起動経路では呼ばれない。**既に開始済みの旧Workflowは別途状態確認すること。** 他のSEO Editor機能はこの変更の対象外。

## 日次の新フロー（JST、目標であり時刻保証ではない）
1. **08:00** ChatGPTの定期タスクが既存の記事とOpen PRを確認し、利用可能なら最新の `data/seo-opportunities.json` も読む。そのうえでWeb調査を行い、候補3〜5件を作る。候補は新規記事だけに固定せず、GSCで伸長余地が大きい既存記事の改善を含めてよい。保存済み候補が古くても有料APIを呼ばない。
2. ChatGPTは `article-factory/candidates` ブランチに `data/article-candidates/batch_YYYY-MM-DD_<id>.json` と `latest.json` を保存し、保存内容を読み直した後、番号・candidateId付きでユーザーへ通知する。既存の同日選択キュー・PRと重複させない。
3. **ユーザーは記事を2本選択するだけ。** 朝の通知に「1本目: 2、2本目: 4」のように返信する。候補IDやタイトルを保持してChatGPTが承認済み選択としてGitHubへ永続化する。
4. ChatGPTの通常チャット/定期タスクが、1本ずつ、Web調査・一次資料の出典チェック・既存記事との差分検証・構成・本文執筆・内部リンクの実在確認を行う。公開済み記事の文章や著者の体験談を捏造しない。検索可能な情報が足りない場合は公開を止める。
5. ChatGPTは記事Markdownと `data/article-runs/<runId>-image-plan.md` を専用branchに保存し、PRを作る。Google Drive記事フォルダには画像プロンプト `image-prompts.md` と `images/` を用意し、各URLを通知する。
6. **ユーザーは画像4枚を作成してDrive `images/` に保存するだけ。** 受領後に画像監査→WebP変換→記事・OGへ埋め込み。画像と本文が矛盾する場合は無理に配置せず停止。
7. 新しいPR head SHAに対するGitHub Actionsと利用可能なCloudflare側チェックが成功し、実表示・出典・内部リンク・4枚・OG・スマホを確認できた場合に限り、指定の12:00/18:00以降に公開する。時間を過ぎても未検証なら公開しない。

## 無料SEOシグナルによる朝8時候補スコア

Google Ads Keyword Planner、Semrush API、Ahrefs APIなどの有料データ取得を候補選定の必須条件にしない。候補は **GSC実測 + 無料Webシグナル + 既存記事資産** で評価する。Google Trendsや検索結果の取得に失敗した項目は `unavailable/unchecked` とし、推測で埋めない。

候補ごとの基礎点は100点満点。

- **GSC: 0〜35点** — strong 35 / medium 25 / weak 10 / none 0。候補自身または関連クラスターの表示・順位・伸びを根拠にする。
- **SERP機会: 0〜25点** — high 25 / medium 15 / low 5 / unchecked 0。上位結果が検索意図を満たしているか、情報が古いか、NARU独自角度が入る余地があるかを見る。大手/個人サイトという属性だけで判定しない。
- **Google Trends: 0〜10点** — rising 10 / stable 5 / falling 0 / unavailable 0。取得できない場合は0点で、下降扱いにはしない。
- **サジェスト・PAA・関連検索: 0〜10点** — 意味の異なる周辺需要が5件以上=10、2〜4件=6、1件=2、取得不能/なし=0。
- **クラスター適合: 0〜15点** — strong 15 / medium 8 / weak 0。既存の優先記事群を内部リンクで押し上げられるかを見る。
- **独自・一次情報角度: 0〜5点** — 官公庁・公式発表・求人票検証・著者が実際に持つ一次情報など、他記事との差分を作れる場合5点。

カニバリ懸念が medium なら **-20点**。high は点数にかかわらず候補化をブロックする。

### 根拠ゲート

新規候補は点数だけで採用せず、次のどれかを満たす必要がある。

1. GSCが strong/medium、または GSC weak + clusterFit strong。
2. SERP high/medium + サジェスト/PAA/関連検索 high/medium。
3. Trends rising + 独自・一次情報角度あり + SERP high/medium。

A=80〜100、B=65〜79、C=50〜64、D=0〜49。朝の通常候補は原則 **A/Bかつ根拠ゲート通過**を優先する。3件未満になる場合だけCを補欠として提示し、Dは提示しない。時事・独自検証枠も根拠ゲートを省略しない。

候補JSONでは、評価した場合に `selectionEvidence`, `selectionScore`, `selectionGrade`, `selectionGatePassed` を保存できる。これらは任意項目で、過去バッチとの後方互換性を保つ。数値やシグナルを取得していない場合は省略または unavailable/unchecked とし、作らない。

## GitHub向けデータ形
候補バッチは `src/lib/article-factory/types.ts` の `CandidateBatch` と `ArticleCandidate` に準拠。
`batchId`, `generatedAt`, `trigger: "manual"`, `candidates`, `inventorySize`, `nextArticleId`, `notes` が必須。
候補ごとに `id`, `title`, `primaryKeyword`, `secondaryKeywords`, `searchIntent`, `differenceFromExisting`, `reasonToWriteNow`, `category`, `proposedSlug`, `riskFlags`, `nearestExistingSlugs`, `searchEvidence`, `blocked`, `blockedReasons` を満たす。無料SEOシグナルを評価した候補は任意で `selectionEvidence`, `selectionScore`, `selectionGrade`, `selectionGatePassed` も保存する。
Search Consoleデータを実際に読んでいない場合は `searchEvidence: null` とする。\n\n### SEO Opportunity の扱い\n`npm run data:seo-opportunities` は既存のSearch Console認証を使い、page × query の過去28日データから次を抽出する。\n- `strikingDistance`: 平均掲載順位11〜30位かつ最低表示回数を満たす検索クエリ。既存記事リライト候補。\n- `lowCtr`: 10位以内だがCTRが閾値以下の検索クエリ。タイトル・description・検索意図整合の改善候補。\n- `cannibalization`: 同じ検索クエリで複数記事が表示される候補。統合・役割分担・内部リンク見直しの確認対象。\n- `prioritySlugs`: 上記から重複を除いた優先監査slug。\n\n公開GitにはGSCのclicks / impressions / CTR / positionの実数値を保存しない。query・slug・分類・順位だけを `data/seo-opportunities.json` に保存する。候補生成ではこのスナップショットをWeb調査・既存記事重複確認と併用し、**新規記事を増やすより既存記事改善の期待値が高い場合は、既存記事改善を候補として優先してよい**。また、同一クエリで複数記事が出ている場合は新規記事を追加する前にカニバリを確認する。
`data/article-candidates/latest.json` は `{"batchId": "...", "savedAt": "ISO8601"}`。
生成記事は `content/articles/<slug>.md` の既存frontmatter形式を維持し、既存slugを上書きしない。

## 実行上の限界
- ChatGPT定期タスクは実行頻度・利用枠・接続アプリの可用性に依存する。無制限・完全無人・時刻厳守を保証しない。
- NARUのその他のSEO Editor画面に残るAPI機能を操作するとOpenAI API請求が発生し得る。請求を完全に止めたい場合は別途SEO Editorも無効化する。
- 旧PR #22（記事39）の画像反映・レビューは新方式の移行とは独立に処理する。既存PRを生成し直さない。
