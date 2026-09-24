# NARU新規記事 — ChatGPTのみ・別途OpenAI API課金なし

**対象**: NARU新規記事の「候補・調査・構成・本文・内部リンク・出典修復」。OpenAI API と GPT Work は使わない。
GitHubとDriveは既存の接続済みアプリで操作する。GitHub ActionsとVercelのCI・デプロイは既存の仕組みを使う。

## 課金防止の実装
- `POST /internal/api/article-factory/start` は認証後 410。旧ワークフロー起動・再実行を禁止。
- `POST /internal/api/article-factory/candidates` は認証後 410。保存済み候補の `GET` は継続。
- `GET /api/cron/article-candidates` はCron認証後 410。さらに `vercel.json` から毎朝08:00の旧Cronを削除。
- ダッシュボードの「候補を生成」は「保存済み候補を更新」に変更し、「この記事を作る」は「候補をコピー」に変更。旧POSTを呼ばない。
- 旧 `research.ts` / `generation.ts` のOpenAI呼び出し実装は、履歴・過去ワークフローの参照のため残すが、上記のHTTP起動経路では呼ばれない。**既に開始済みの旧Workflowは別途状態確認すること。** 他のSEO Editor機能はこの変更の対象外。

## 日次の新フロー（JST、目標であり時刻保証ではない）
1. **08:00** ChatGPTの定期タスクが既存の記事とOpen PRを確認して、Web調査で新規候補3〜5件を作る。保存済み候補が古くても有料APIを呼ばない。
2. ChatGPTは `article-factory/candidates` ブランチに `data/article-candidates/batch_YYYY-MM-DD_<id>.json` と `latest.json` を保存し、保存内容を読み直した後、番号・candidateId付きでユーザーへ通知する。既存の同日選択キュー・PRと重複させない。
3. **ユーザーは記事を2本選択するだけ。** 朝の通知に「1本目: 2、2本目: 4」のように返信する。候補IDやタイトルを保持してChatGPTが承認済み選択としてGitHubへ永続化する。
4. ChatGPTの通常チャット/定期タスクが、1本ずつ、Web調査・一次資料の出典チェック・既存記事との差分検証・構成・本文執筆・内部リンクの実在確認を行う。公開済み記事の文章や著者の体験談を捏造しない。検索可能な情報が足りない場合は公開を止める。
5. ChatGPTは記事Markdownと `data/article-runs/<runId>-image-plan.md` を専用branchに保存し、PRを作る。Google Drive記事フォルダには画像プロンプト `image-prompts.md` と `images/` を用意し、各URLを通知する。
6. **ユーザーは画像4枚を作成してDrive `images/` に保存するだけ。** 受領後に画像監査→WebP変換→記事・OGへ埋め込み。画像と本文が矛盾する場合は無理に配置せず停止。
7. 新しいPR head SHAに対するGitHub ActionsとVercel Previewが成功し、実表示・出典・内部リンク・4枚・OG・スマホを確認できた場合に限り、指定の12:00/18:00以降に公開する。時間を過ぎても未検証なら公開しない。

## GitHub向けデータ形
候補バッチは `src/lib/article-factory/types.ts` の `CandidateBatch` と `ArticleCandidate` に準拠。
`batchId`, `generatedAt`, `trigger: "manual"`, `candidates`, `inventorySize`, `nextArticleId`, `notes` が必須。
候補ごとに `id`, `title`, `primaryKeyword`, `secondaryKeywords`, `searchIntent`, `differenceFromExisting`, `reasonToWriteNow`, `category`, `proposedSlug`, `riskFlags`, `nearestExistingSlugs`, `searchEvidence: null`, `blocked`, `blockedReasons` を満たす。
Search Consoleデータを実際に読んでいない場合は `searchEvidence: null` とする。
`data/article-candidates/latest.json` は `{"batchId": "...", "savedAt": "ISO8601"}`。
生成記事は `content/articles/<slug>.md` の既存frontmatter形式を維持し、既存slugを上書きしない。

## 実行上の限界
- ChatGPT定期タスクは実行頻度・利用枠・接続アプリの可用性に依存する。無制限・完全無人・時刻厳守を保証しない。
- NARUのその他のSEO Editor画面に残るAPI機能を操作するとOpenAI API請求が発生し得る。請求を完全に止めたい場合は別途SEO Editorも無効化する。
- 旧PR #22（記事39）の画像反映・レビューは新方式の移行とは独立に処理する。既存PRを生成し直さない。
