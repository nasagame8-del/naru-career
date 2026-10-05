# NARU Research｜3,419社フルラン（Stage 4確定 / Stage 5 provisional） — 2026-10-04

- reportId: USER-SHOKUBA-FULLRUN-3419-20261004
- completedInstructionId: USER-SHOKUBA-FULLRUN-3419-20261004（ユーザー直接依頼。`NEXT_INSTRUCTION.md` は `IDLE`）
- status: DONE_PENDING_REVIEW（Draft PR #143 のブランチへpush済み。master未反映・記事未作成・未公開）
- branch: `research/shokuba-20261004`
- 指示書: `docs/research/shokuba-full-run-3419-claude.md`
- 詳細レポート: `docs/research/shokuba-2026-10-04-full-run-report.md`

## 実施内容

- Stage 4を3,419社全件で完走（`--expect 3419` でフレームサイズをassert）
- high 2,354 / medium 141 / low 172 / none 752 = **3,419**（`confidenceSumCheck` 一致）
- 採用ページ発見2,495社（72.97%）。全数調査のため加重発見率は粗率と同値
- Stage 5を2,436社で実行し `provisional: true` で保存。求人レコード7,622件、到達1,464社
- `TypeError: terminated` 対策の回帰テスト `scripts/research-web.test.mjs` を追加
- Stage 4確定データから記事候補8件、Stage 5 provisionalから5件を導出
- 300社パイロット成果物は一切変更していない

## テスト結果

- `node --test scripts/research-web.test.mjs`: 5 tests / 5 pass / 0 fail（新規）
- `node --test scripts/research-jobs.test.mjs`: 53 tests / 53 pass / 0 fail
- `node --check` 5ファイル: エラーなし
- 実ランでの `TypeError: terminated` 再発: 0件
- `body_read_failed` ガード発火: 2件（いずれもページ単位の失敗として記録しrun継続）
- `runPool` の `onItemError`（企業単位の明示failure）発火: 0件

## 変更ファイル

- `scripts/research-web.test.mjs`（新規）
- `docs/research/shokuba-2026-10-04-full-run-report.md`（新規）
- `data/research/shokuba/2026-10-04-discovery-full-3419.json` / `.csv`（新規）
- `data/research/shokuba/2026-10-04-discovery-sample-full-3419.csv`（新規）
- `data/research/shokuba/2026-10-04-jobs-full-3419-provisional.json` / `.csv`（新規）
- `data/research/shokuba/2026-10-04-full-analysis.json`（新規）
- `data/research/shokuba/checkpoints/*.jsonl`（新規・resume用）
- `docs/agent-handoff/REPORT.md`（本追記）

## git diff概要

スクリプトの挙動変更なし。追加はテスト1本とデータ成果物・レポートのみ。
既存の `scripts/research-*.mjs` と300社パイロットの成果物に差分はない。

## 既知の問題

1. **Stage 5は precision 0.97 / recall 0.47**。求人件数系の数字はすべて過小評価。確定値として記事化できない
2. 採用求人レコードの55.2%が `job_section`（ページ内セクション分解）。1求人=1レコード未達成
3. 「職種 / 募集ポジション」等のテーブル見出しを求人名と誤検出（40件）
4. `employmentType` 未正規化（`正社員`/`FULL_TIME`、`CONTRACTOR`/`Contractor` 併存）
5. 求人レコードの重複14.0%（1,067件）
6. `scripts/research-stage45-analysis.mjs` のフィールド名がStage 5側のリネームに未追従。
   分析JSONの `jobs.granularity.roleNamedJobRecords` と `jobs.sourceCounts` がnullになる（実データはjobs JSON側にある）
7. 採用ページの誤検出1件（日本IBMにIBMカタール/アラビア語ケーススタディページを割当）。
   ユニーク採用ページ数は2,495ではなく2,492
8. Stage 4の `httpAccounting` は最終ラン（2,531社）のみの計測。3,419社全体のリクエスト総数は実測値がない
9. `2026-10-04-jobs-full-3419-provisional-excluded.json`（20MB・除外10,724件）は
   300社パイロットの前例に合わせてcommitしていない。再実行で再生成可能

## 判断が必要な項目

- Stage 5の精度改善（recall 0.47 → 一覧ページ側の取りこぼし解消）を次工程にするか、
  Stage 4の確定データだけで記事を1本作るかの優先順位
- `excluded.json`（20MB）をリポジトリに含めるかどうか

## 推奨する次の作業

1. Stage 4確定データで記事候補1（国DB 5.1% vs 実在73.0% ＝14.3倍）を執筆
2. Stage 5の一覧ページ抽出を改善し recall を上げてから求人単位の数字を確定値へ昇格
3. `research-stage45-analysis.mjs` のフィールド名をStage 5側へ追従させる
4. `employmentType` の正規化（日本語/JSON-LD enum の統合）

## 運用上の事故（データの素性に関わるため記録）

同一リポジトリで並行作業していた別セッションにより2件発生。詳細は詳細レポート第5節。

1. 作業ツリーが `ui/article-decoration-refresh` へcheckoutされ、`scripts/research-*.mjs` が消失
2. `git stash --include-untracked`（23:02・stash `b443d08`）が実行中の未追跡成果物を巻き上げ、
   **Stage 5の約1,695社分の結果が消失**（checkpointに残ったのは165社）。再開ランで再取得済み

以降は専用worktree（`C:\Users\nasaz\naru-shokuba-research`）で作業し、メインツリーから隔離した。
Stage 4のcheckpointは事故前に完走していたため3,419行が完全な状態で保全されている。
復元時のCRLF変換はバイト単位でLFへ戻し、`discovery-full-3419.json` は元の7,286,743バイトと一致を確認。

---

# NARU Research｜Stage 4 採用ページDiscovery / Stage 5 求人単位化 — 2026-10-04

- reportId: USER-SHOKUBA-STAGE45-20261004
- completedInstructionId: USER-SHOKUBA-STAGE45-20261004（ユーザー直接依頼。NEXT_INSTRUCTIONはIDLE）
- status: DONE_PENDING_REVIEW（Draft PR #143 のブランチへpush済み。master未反映・記事未作成）
- branch: `research/shokuba-20261004`
- 詳細レポート: `docs/research/shokuba-2026-10-04-stage4-5-report.md`

## 実施内容

- 旧194URL（しょくばらぼ採用ページ欄）はパイロットとして保持し、主母集団から外した
- 母集団を「情報通信業 × 企業HPあり」3,512社 → 層化可能3,478社 → ホスト重複除外3,419社に定義
- 企業規模7区分 × 都道府県3区分の21セルへ均等割当で300社を抽出（seed固定・再現可能）
- Stage 4 Discoveryを実装（トップページのアンカー / robots.txtのSitemap / sitemap内URL /
  自社サイト内採用ページ / 企業サイトから直リンクされた公式ATS のみ）
- confidence high/medium/low を付与し、lowは自動採用しない設計
- Stage 5で採用ページから求人詳細へ遷移し、1求人=1レコードで構造化（JSON-LD優先・HTML補完）
- 共通ライブラリ `scripts/research-web.mjs` を切り出し、抽出ロジックのユニットテストを追加
- 未解決97社のみでサイトルートへのフォールバックを検証（+10社、合算71.0%）
- 3,419社への拡大コストを実測から外挿し、拡大可否を判断

## テスト結果

- `node --test scripts/research-jobs.test.mjs`: 26 tests / 26 pass / 0 fail
  - テストで実データに影響する2件のバグを検出・修正（勤務地「東京都渋谷区」から京都府を生成していた／
    サイト見出し「Recruit 採用情報」を求人名にしていた）
- `npx eslint scripts/research-*.mjs`: 0 errors / 0 warnings
- `node --check` 4ファイル: エラーなし
- Stage 4本番ラン: 300社 / 259.3秒 / HP成功273 / 採用ページ203 / 403=5 / 429=0 / robots block=1
- Stage 5本番ラン: 202社 / 182.0秒 / 到達106社 / 求人248件 / 非求人ページ221件除外
- 未実施: リポジトリ全体の `npm test`（アプリコード・既存テスト対象に変更なし）

## 変更ファイル

- 追加: `scripts/research-web.mjs`, `scripts/research-discover-recruitment.mjs`,
  `scripts/research-jobs.mjs`, `scripts/research-jobs.test.mjs`,
  `scripts/research-stage45-analysis.mjs`,
  `data/research/shokuba/2026-10-04-discovery-sample-300.csv`,
  `data/research/shokuba/2026-10-04-discovery-300.json` / `.csv`,
  `data/research/shokuba/2026-10-04-discovery-300-retry.json`,
  `data/research/shokuba/2026-10-04-jobs-300.json` / `.csv`,
  `data/research/shokuba/2026-10-04-discovery-analysis.json`,
  `docs/research/shokuba-2026-10-04-stage4-5-report.md`
- 変更なし: 旧パイロットの `2026-10-04-recruitment-pages-pilot.*`（保持）

## git diff概要

12 files added（データ中心）。アプリコード・既存スクリプトへの変更なし。

## 既知の問題

- Stage 5の「1求人=1レコード」達成度が53.6%。1ページ内複数求人の分解が未実装
- `isJobLevelRecord` の判定順を直すとコミット済みデータと再現しなくなるため、拡大ランと同時に修正すべき
- JobPosting JSON-LDは採用ページ203社中1社（0.5%）。構造化データ経由は当てにできない
- 年収33件・必要経験年数40件と母数が小さく、分布を記事に出せない

## 判断が必要な項目

- Stage 4を3,419社へ拡大するか（レポートの結論は「拡大する価値あり」。約49分・約7,000リクエスト）
- Stage 5は改良後に拡大するか（レポートの結論は「改良が前提」）

## 推奨する次の作業

1. Stage 5の改良（1ページ内複数求人の分解、recordLevelの型分け、判定順の修正）
2. その後にStage 4を全3,419社へ拡大（Stage 5も同時に再実行）
3. 四半期ごとの定点観測として同スクリプトを再実行

---

# NARU Research｜しょくばらぼ × 公開採用ページ — 2026-10-04

- reportId: USER-SHOKUBA-RESEARCH-20261004
- completedInstructionId: USER-SHOKUBA-RESEARCH-20261004（ユーザー直接依頼。NEXT_INSTRUCTIONはIDLE。正本は `docs/research/shokuba-claude-handoff.md`）
- status: DONE_PENDING_REVIEW（Draft PR #143 のブランチへpush済み。master未反映・記事未作成）
- branch: `research/shokuba-20261004`
- 詳細レポート: `docs/research/shokuba-2026-10-04-report.md`

## 実施内容

- 既存成果物（stage 1のsummary/seed、旧パイロット）を確認し、未完了工程のみ実施
- stage 2を再実装（`scripts/research-recruitment-pages.mjs`）。採用ページ一意194件を取得し、
  指示書の必須スキーマ（fetchedAt / pageTitle / httpStatus / JobPosting詳細）、リダイレクト追跡、
  第三者求人サイト判定、ページ種別判定、古い新卒ページ判定を追加
- stage 3を新規作成（`scripts/research-shokuba-analysis.mjs`）。母数併記の集計10種＋品質レポートを出力
- 公式データの「制度あり」回答と採用ページ上の記載を法人番号で突合（新規指標）
- `docs/research/shokuba-2026-10-04-report.md` に記事候補10件を導出
- CIワークフローを `workflow_dispatch` のみに変更（pushで再クロールしデータを上書きする事故を防止）
- 旧Python版stage 2に非推奨コメントを追記（初回パイロットの出所として保持）

## テスト結果

- `node --check scripts/research-recruitment-pages.mjs` / `scripts/research-shokuba-analysis.mjs`: PASS
- スモークラン（8件・4件、`--out-tag smoke` で本データを汚さず）: 8/8, 4/4 取得成功
- 本番ラン: 対象194件 / 成功181件（93.3%）/ 失敗13件（404×8, 403×1, 500×1, robots拒否×1, 証明書エラー×2）
- 集計の再現性: 2回実行し `generatedAtUtc` 以外の差分なし
- 検算: 失敗内訳合計=13、制度開示件数がstage 1のsummaryと一致、規模帯の企業数合計=8,118
- 未実施: リポジトリ全体の `vitest`（アプリコード・テスト対象コードに変更なし）

## 変更ファイル

- 追加: `scripts/research-recruitment-pages.mjs`, `scripts/research-shokuba-analysis.mjs`,
  `data/research/shokuba/2026-10-04-analysis.json`, `docs/research/shokuba-2026-10-04-report.md`
- 更新: `data/research/shokuba/2026-10-04-recruitment-pages-pilot.json` / `.csv`,
  `.github/workflows/shokuba-research.yml`, `scripts/research-recruitment-pages.py`（非推奨コメント）
- 変更なし: `scripts/research-shokuba.py`, `2026-10-04-summary.json`, `*-information-communications-seed.csv`

## git diff概要

8 files changed, 15,875 insertions(+), 3,654 deletions(-)（大半は再取得したパイロットJSONの差分）

## 既知の問題

- stage 2のスクリプトが新旧2本あり、旧Python版は出力先が同一なので誤実行で上書きされる
- このマシンにPythonがないため、stage 2/3はリポジトリ慣習に合わせNodeで実装（stage 1はPythonのまま）
- 職種単位の粒度がないため、ポートフォリオ等一部指標は件数が一桁

## 判断が必要な項目

- 旧 `scripts/research-recruitment-pages.py` を削除してよいか
- 記事化する候補の選定（候補1/2/3を推奨）

## 推奨する次の作業

- 記事候補1〜3のいずれかを選び、SEO Editorの通常フローで執筆（本セッションでは未着手）
- 145社の自社採用ページを職種単位で再構造化し、職種×第二新卒×年収のクロスを作る
- 四半期ごとの定点観測として同スクリプトを再実行

---

# NARU 全サイト Typography QA — 2026-10-04

- reportId: USER-TYPOGRAPHY-QA-20261004
- completedInstructionId: USER-TYPOGRAPHY-QA-20261004（ユーザー直接依頼。NEXT_INSTRUCTIONはIDLE）
- status: DONE_PENDING_REVIEW（PR未作成・master未反映）
- branch: `claude/funny-cray-auvl1x`

## 不自然改行の原因
1. 日本語は既定で全文字間が改行可能。見出し・カードに文節単位の改行指定がなく「制｜作実績」「考｜える」など熟語途中で割れていた。
2. `.editorial-title` とモバイル `.prose` の `overflow-wrap:anywhere`（+ `word-break:break-word`）。
3. `line-break` 未指定で句読点・小書き仮名の禁則が緩い（句読点行頭21件）。
4. 1024–1199pxで記事カードが3列＋サイドバーとなり、タイトル幅が約10字まで狭まっていた。
5. パンくずが記事タイトル全文を複数行で表示しH1と重複。フッターリンク列が768pxで狭すぎた。

## 共通ルール（globals.css）
- `html { line-break: strict }`。
- h1–h6 / `.jp-title` / フッターリンク: `word-break:normal; line-break:strict; overflow-wrap:normal; text-wrap:pretty`、`@supports (word-break:auto-phrase)` で文節改行。
- `overflow-wrap:anywhere` を全廃。`.prose` は `break-word`（1行を超える長いURL・英数字のみ折返し、通常英単語は割らない）。`pre` は横スクロール、表は既存の横スクロール維持。
- `.editorial-title`: `clamp(26px, 1.25vw + 22px, 33px)` / line-height 1.45。balanceも比較したが「切り替えた｜後」等が出たためprettyを採用。
- `.card-title`（一覧・関連記事・note）: 15–15.5px / 1.65 / 3行clamp。記事グリッドの3列化を1200px以上に変更（1024–1199pxは2列）。
- `.breadcrumb`: 1行・現在ページを省略表示（モバイル最大14em）。BreadcrumbJSON-LDは未変更。
- `.ui-nowrap`: カテゴリタグ。カテゴリタブは既存nowrap。日付は `time, .date-text` でnowrap。
- フッターナビ: md 3列→lg 3列（768pxは2列）。

## 日付フォント
- ユーザー提供の「YDW バナナスリップplus」（ymnk design works）を数字・`-/.:`・年月日のみにサブセットし `public/fonts/ydw-bananaslip-plus-date.woff2`（2.9KB）として追加。`unicode-range` で日付文字だけに適用。
- 適用先: 全 `<time>`（記事公開/更新日・カード・関連記事・更新履歴・note投稿）、診断結果の診断日、プライバシーポリシーの制定日/最終更新日（`<time>`で囲んだのみ、文言不変）。
- 既存の `font-mono` 指定を日付要素から外した。

## Visual QA（自動計測 + スクリーンショット）
- 17ページ × 375/390/430/768/1024/1440px。記事は短3・中3・長3本。
- 修正前: 孤立1–2文字行150件、句読点行頭21件。修正後: 孤立4件（「違い」「する」の2文字行2種、文節単位なので許容）、句読点行頭0、括弧孤立0、英単語分割0、要素はみ出し0、横スクロール0。
- カード高さ差: 1024/1440pxで0、375/768pxで最大25px。
- テスト: `tsc --noEmit` 成功、変更TSXのESLint成功、vitest 319件成功、`npm run build` 成功。

## 既知の問題・判断事項
- `auto-phrase` はChromium系のみ。Safari/Firefoxは `line-break:strict` + `text-wrap:pretty` の範囲で改善（文節改行はしない）。
- Chromeの文節モデル由来で「教材ど｜おり」「切り｜替える」が一部幅で残る。CSSのみでは解消不可（`<wbr>` 挿入は禁止のため未対応）。
- フォントのWeb埋め込み可否はymnk design worksの利用規約で最終確認してください（NEEDS_DECISION）。
- 変更禁止項目（タイトル文字列・本文・slug・metadata・JSON-LD・リンク・画像・日付値）は未変更。

## 変更ファイル
globals.css / articles/[slug]/page.tsx / articles/page.tsx / category/[slug]/page.tsx / privacy/page.tsx / shindan/_components/ResultContent.tsx / ArticleList.tsx / LatestNotePosts.tsx / Footer.tsx / public/fonts/ydw-bananaslip-plus-date.woff2

## 推奨する次の作業
- フォント規約確認後、PR作成→Cloudflareプレビューで実機（iOS Safari）確認。

## 2026-10-04 フォント・表記の追加調整

- ユーザー指定により、メディア共通フォントを Noto Sans JP / Noto Serif JP に統一。数字用の旧等幅フォントも Noto Sans JP に統一。
- CAREER GUIDE と重複 NOTE ラベルを削除。ABOUT THE AUTHOR、SHARE、NARU Point を日本語化。
- 検証: 変更した TSX の ESLint、Next.js 本番ビルド成功。ブラウザーで適用フォント・英文ラベル削除、375px表示で横溢れなしを確認。
- RPG診断独自の演出フォント、記事本文、ブランド名は今回のメディアUI調整の対象外。
# NARU Editorial Refresh — 2026-10-04

- reportId: USER-EDITORIAL-REFRESH-20261004
- completedInstructionId: USER-EDITORIAL-REFRESH-20261004（本タスクの直接依頼。既存の別タスクは実行していない）
- status: DRAFT_REVIEW / CLOUDFLARE_BUILD_UNVERIFIED
- branch: `ui/goodpatch-editorial-refresh`
- base: `63225d77da21b1c5aefc4c23a832112b7a4d281d`（取得時の最新master）

## 変更と Before / After

著者中心の大型Heroと縦並び一覧から、コンパクトなブランド紹介、3列の記事カード、右サイドバーへ変更。参考サイトの中央ロゴ、白いヘッダー、淡い背景、画像→カテゴリ・日付→タイトルの階層に寄せた。NARUのCream / Tea Green / Amberは維持。

- 共通の最大幅1200px、サイドバー272px、間隔36px。記事本文は1440px画面で740px。
- 1024px以上で3列＋サイドバー、640〜1023pxは2列、639px以下は1列。
- サイドバーは診断、転職ガイド、著者紹介の順。モバイルでは6記事の後に診断とガイドへのリンク。
- 記事本文17px / 1.95、モバイル16px / 1.95。H1はSans Serifの26〜38px。H2は細い緑の左罫線。
- フッターはTea Greenの複数列。既存リンク・広告表記・survey計測を保持。
- カテゴリの読む順番と「まず読むべき記事」、絞り込み、人気順・おすすめ順、展開・折り畳みを維持。
- 内蔵imagegenでオリジナルの診断用イラストを生成。900×600 WebP、88,494 bytes。既存記事画像は変更していない。

## 参考分析

https://goodpatch.com/blog と /blog/2026-09-sokai を1440 / 768 / 375pxで目視確認。録画56秒もフレーム抽出して確認した。デスクトップは中央ロゴと下段ナビ、画像主体の3列カード＋バナーサイドバー。タブレットは2列、スマホは1列で本文を広く使う。カードには大きな枠線や強い影がなく、記事詳細は白い読み物の面と右サイドバーで構成される。ロゴ・文章・画像・ソースコードは転用せず、レイアウトと情報の階層を参考にした。

## 検証結果

- `npm ci`: 成功、依存追加なし。
- `npm test`: Windows sandboxでesbuildの親ディレクトリ列挙が拒否され起動失敗。そのためリポジトリ設定は変えず、同等の一時ESM設定（同じalias、include、node環境）と`--configLoader native`で実行。Vitest 17ファイル / 293件成功。
- package.jsonの残りのNodeテスト6ファイル: 45件成功。合計338件。
- `npx tsc --noEmit`: 成功。
- 変更した全TSXへのESLint: 成功。
- `npm run lint`: 既存の未変更ファイルに61 errors / 12 warnings。主にscriptsのCommonJS require、内部ダッシュボード等。UI改修による新規指摘なし。
- `npm run build`: 成功。Turbopack、本番132ページ生成。最終変更後にも再実行して成功。
- `npm run build:cloudflare`: WindowsでOpenNextがopen-next.config.tsを解決する前に親フォルダのAccess deniedで停止。Cloudflareビルド成功とは扱っていない。設定・ワークフローは未変更。
- 開発画面: 初回Turbopackの子プロセス起動が権限で停止。バンドルNode＋Webpackで再起動してQAを完了。以降の新規ブラウザエラーなし。
- Home、Articles、Category、記事2本、About × 375 / 430 / 768 / 1024 / 1440px: ページ全体の横はみ出し・読み込み済み画像の破損なし。
- 1440px: 本文740px、サイドバーはスクロール2000px時もtop24px。表・本文・フッターを目視確認。
- モバイル: タイトル、カード、本文、CTA、フッターを目視確認。サイドバー非表示。
- Articles: カテゴリで4件に絞り込み、人気順・おすすめ順のpressed状態、12→58件展開→12件に戻る操作を確認。
- Home: 12→58→12件を確認。キーボードTabによるフォーカス枠も確認。
- 変更前後のHTML比較: 記事2本 / category / articles / aboutのmetadata・canonical・JSON-LD・prose HTMLが完全一致。
- `content/`、既存記事画像、`src/lib/`、診断、計測、SEO/Editor、依存、Cloudflare設定に差分なし。

## 変更ファイル

- `src/app/articles/[slug]/page.tsx`
- `src/app/articles/page.tsx`
- `src/app/category/[slug]/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/ArticleBrowser.tsx`
- `src/components/ArticleList.tsx`
- `src/components/CategoryNavBar.tsx`
- `src/components/CategoryTabs.tsx`
- `src/components/Footer.tsx`
- `src/components/Header.tsx`
- `src/components/HeroSection.tsx`
- `src/components/LatestNotePosts.tsx`
- `src/components/EditorialSidebar.tsx`
- `src/components/MobileCareerCTA.tsx`
- `public/images/editorial/career-discovery.webp`

- `docs/agent-handoff/REPORT.md`（この報告を追記）

## 残課題・判断が必要な項目

Cloudflare用ビルドをLinux/CI環境で確認すること。全体Lintの既存指摘は別作業。実画面の見た目はユーザー確認待ち。masterへのpush、merge、本番deployは行っていない。

## 推奨する次の作業

Draft PRでデザイン確認後、Cloudflareビルドを検証してからマージ判断。

---

# Article 59 preview preparation — 2026-10-04

- reportId: USER-ARTICLE-59-PREVIEW-20261004
- completedInstructionId: USER-ARTICLE-PREVIEW-20261004
- status: PREVIEW_DEPLOYMENT_IN_PROGRESS
- branch: article-factory/2026-10-04-59-tutorial-portfolio
- 実施内容: User images archived to Drive, four metadata-free WebPs reflected on this article PR and byte/blob readbacks matched. Added isolated Cloudflare preview workflow with a unique non-production worker name, read-only requests and noindex headers.
- テスト結果: Image-stage CI completed/success. Internal article slugs exist on master; three body references/alt match images; no raw bold markers. Current-head Cloudflare build and browser QA will be recorded in selected-queue after completion.
- 変更ファイル: Article Markdown and run records, four public WebPs, .github/workflows/cloudflare-article-preview.yml, this report.
- git diff概要: New article and images; preview deployment workflow only. No production merge.
- 既知の問題: Human fact check and user visual approval remain pending. The previous fact record describes the initial pre-image stage.
- 判断が必要な項目: User visual approval of current article preview before publication.
- 推奨する次の作業: Verify preview deployment and rendered PC/mobile article, record latest SHA and URL in selected-queue, then request user visual review.

---

# Claude Code Report

## REPORT-011 — /about の「よくある質問」を削除

- reportId: `REPORT-011`
- completedInstructionId: `USER-ABOUT-REMOVE-FAQ-2026-10-03`（ユーザー直接依頼。NEXT_INSTRUCTIONはIDLE）
- status: `DONE`
- branch: `claude/inspiring-cerf-3odtbm`（PR未作成）
- 実施内容: `src/app/about/page.tsx` から「よくある質問」見出し・アコーディオンUI・`aboutFaqs` データ・FAQPage構造化データ（JSON-LD）を削除。表示されないFAQをJSON-LDに残すとリッチリザルトのガイドライン違反になるため一緒に削除。Person / Breadcrumb のJSON-LDは維持。
- テスト結果: tsc exit 0、eslint src/app/about エラー0、vitest 288件pass。
- 変更ファイル: `src/app/about/page.tsx`, `docs/agent-handoff/REPORT.md`
- git diff概要: about/page.tsx から約50行削除（追加なし）。
- 既知の問題: なし。
- 判断が必要な項目: なし。
- 推奨する次の作業: master へ取り込み後、本番の /about でFAQ非表示を確認。

## REPORT-010 — ブランドカラー統一・診断SEO整理・既知不具合の修正

- reportId: `REPORT-010`
- completedInstructionId: `USER-SITE-AUDIT-FOLLOWUP-2026-10-01`（ユーザー直接依頼。INST-004は未着手のまま）
- status: `DONE`（resume-template の配布ファイルのみ判断待ち）
- branch: `claude/article-tag-fix-c7w0z4`（PR未作成）
- 実施内容:
  - `6c3fe1e` fix: align NARU brand colors — globals.css のトークンを Tea Green #1F6F66 / Amber #B5691B に変更（primary/-soft/-hover、accent、amber、amber-ink）。診断UI（shindan.css の --primary/--gold と直書きのブランド色、紙吹雪、TYPE_COLORSのフォールバック）も同様。雑記カテゴリは Tea Green と見分けがつかなくなるsageから補助色ネイビーへ。
  - `84614e6` fix: separate diagnosis result and type SEO — /types/* は index,follow・self canonical・OG/Twitter・sitemap掲載。/shindan/result/* は noindex,follow・self canonical・sitemap非掲載、/types/{slug} への導線を2箇所（既存リンクをnext/link化＋解説の後に追加、イベント名は既存の to_type_hub）。
  - `7720660` fix: broken resume template link and article FAQ — /members/resume-template のリンク先 docx が存在しないため「現在ダウンロードできません（準備中）」表示＋お問い合わせ導線に変更。agent-not-recommended の inlineFaq.heading を現行H2「実際に使って感じた、転職エージェントの本音」に修正し、全記事のinlineFaqが配置されることを確認するテストを追加。
  - `09d914c` fix: refine navigation and category visual states — 上部ナビ選択中の下線をAmber（Tea Green上で約1.1:1）からクリーム（amber-soft、約5:1）へ。カテゴリページの番号バッジを塗りつぶしからカテゴリ色の枠線スタイルへ統一。
- テスト結果: vitest 267件pass・node --test 43件pass、tsc exit 0、eslint src エラー0（警告6件はinternalの既存）、next build 成功。Chromiumで / /articles 記事2件 /category/taiken /category/zakki /shindan /shindan/result/wizard /types/wizard /members/resume-template /about を375/390/430/768/1024/1440pxで確認（66通り）し、横スクロール・文字切れ・console error・hydration error なし（外部のGoogle Fonts/GTMはサンドボックスのTLSで読めないため除外）。HTML上で /types/wizard は `index, follow`＋self canonical、/shindan/result/wizard は `noindex, follow`＋self canonical、sitemapは /types/* 16件・/shindan/result/* 0件。
- GA4: template_download（word/pdf）・to_survey はクリック1回につき dataLayer に1件ずつ。cta_click の重複なし。
- 変更ファイル: src/app/globals.css、src/app/shindan/{shindan.css,_components/MatchConfetti.tsx,_components/ResultContent.tsx,result/[slug]/page.tsx,result/[slug]/opengraph-image.tsx}、src/app/types/[slug]/page.tsx、src/lib/categories.ts、src/components/CategoryNavBar.tsx、src/app/category/[slug]/page.tsx、src/app/members/resume-template/page.tsx、content/articles/agent-not-recommended.md（frontmatterのinlineFaq.headingのみ）、src/lib/articles.test.ts、本レポート。
- 旧カラーを残した箇所: 診断UIの羊皮紙・インク系の中間色（#35251f 等）、タイトルロゴ画像（赤・金の画像素材）、16タイプ固有の色（TYPE_COLORS）、/types の見出しバー（向いている／注意などの意味色）、OG画像のネイビー背景、状態表示のsage（AI面接チェックの「把握済み」）。いずれもブランドのprimary/accentではないため。
- 判断が必要な項目（NEEDS_DECISION）: 会員ページで配布する docx。リポジトリ内の docx は記事で無料配布している `public/downloads/職務経歴書テンプレート_NARU.docx` のみで、ページの説明（実際に使った職務経歴書ベース）とは内容が近いが、note有料購入者向けの「NARU配布用」ファイルと同一かは確認できない。同じでよければリンク先をそのファイルに、別ファイルなら `public/members/files/resume-template-naru.docx` に配置すればリンクを戻せる。
- 推奨する次の作業: 上記docxの決定、PR作成とPreviewでの目視確認。

---

## REPORT-009 — サイト全体監査・AIコーディング臭除去

- reportId: `REPORT-009`
- completedInstructionId: `USER-SITE-AUDIT-2026-10-01`（ユーザー直接依頼。INST-004は未着手のまま）
- status: `DONE`（判断事項あり）
- branch: `claude/article-tag-fix-c7w0z4`
- 実施内容:
  - P0: ルートlayoutの `canonical: "/"` が canonical未設定ページ（/shindan, /types/*, /shindan/result/*, 404）へ継承されていた問題を解消し、各ページに自己canonicalを設定。robots.txt で個別許可botに非公開パスのdisallowが効いていなかった問題を修正（/api/ も追加）。本文の箇条書きが無印になっていた問題（preflightのlist-style消去）を修正。日本語の括弧に隣接した `**` が太字にならず記号ごと消えていた11箇所を太字化。`## よくある質問` 以降を末尾まで削除していたため2記事で後続セクション（おすすめエージェント）が消えていた問題を修正。目次の `&#x26;` 表示、カテゴリページFAQの色崩れ、AI面接チェックの `&#10003;` 文字列露出、関連記事の "thumb" 表示、エージェント診断の「準備中」ボタンを修正。ガイド/会員ページのタイトル `| NARU | NARU` 重複を修正。
  - P1: 表を横スクロール対応（1文字ずつ折り返す崩れを解消）、blockquote/h4スタイル追加、モバイルのH2サイズ調整、5ステップのフロー図がPCで本文幅をはみ出す問題を修正、記事メタ行の折り返し、ヒーロー画像のwidth/height/sizesを実ファイル比率に合わせる、診断バナーの初回判定・safe-area・設問数の誤表記（5問→/shindanは20問）を修正、カテゴリページの重複カテゴリナビを削除、目次の開閉表示。a11y: skip link、nav/パンくずのaria-label・aria-current、time dateTime、装飾SVGのaria-hidden、診断の選択肢aria-pressed・progressbar、ネストした<main>の解消、カテゴリタグ文字色のコントラスト改善（amber-ink/sage-ink追加）、全体のprefers-reduced-motion対応。
  - P2: カテゴリ配色・slug対応表の6重複を `src/lib/categories.ts` の theme / getCategoryTheme / getCategorySlug に集約。CategoryNavBar（全ページのクライアントコンポーネント）にCATEGORIES全体（説明文・FAQ）を送らないようlayoutから必要分だけ渡す形に変更。SurveyLink/TemplateDownloadをServer Component化し計測をCtaTrackerの `data-track-event` に一本化（ダウンロード時のcta_click二重計上を解消）。
  - P3: カード・バナーのhover浮き上がり/影/画像ズーム、glass(backdrop-blur)、glow影、NARU Pointの装飾三角と星アイコン、診断の装飾アイコン列、noteボックスの絵文字、診断画面の設計履歴コメント、ページ内の自明なJSXコメントを削除。角丸をrounded-lgに統一。ホームの重複した適職診断CTA（3つ目）を削除。診断の所要時間表記を「約2分」に統一。
- テスト結果: `npm test` vitest 266件pass・node --test 43件pass、`npx tsc --noEmit` exit 0、`npx eslint src` エラー0（警告6件は internal ダッシュボードの既存未使用変数）、`npm run build` 成功。Chromiumで / /articles 記事3本 /category/zakki /category/industry-guide /about /agent-diagnosis /glossary を375/390/430/768/1024/1440pxで確認し横スクロール0。console errorはサンドボックスで外部（Google Fonts/GTM）の証明書が通らないものだけ。全52記事の本文HTMLを修正前後で比較し、差分は意図した太字11箇所・復活した2セクション・目次1件・非表示インラインFAQ1件のみ。
- 変更ファイル: src/app/{layout,page,robots,sitemap,globals.css}、src/app/articles/{page,[slug]/page}.tsx、src/app/category/[slug]/page.tsx、src/app/guides/second-new-grad-complete-guide/page.tsx、src/app/members/resume-template/page.tsx、src/app/privacy/page.tsx、src/app/shindan/{layout.tsx,shindan.css,_lib/data.ts,result/[slug]/page.tsx,result/[slug]/opengraph-image.tsx}、src/app/types/[slug]/page.tsx、src/components/{AgentDiagnosis,AiInterviewCheck,ArticleBrowser,ArticleList,CategoryNavBar,CategoryTabs,CtaTracker,DiagnosisBanner,FAQSection,Footer,Header,HeroSection,LatestNotePosts,ShareButtons,SurveyLink,TableOfContents,TemplateDownload}.tsx、src/lib/{articles,articles.test,categories}.ts、package.json、package-lock.json、本レポート。削除: src/components/ArticleCard.tsx、src/components/MiniAltoBoxes.tsx、public/{file,globe,next,vercel,window}.svg、依存 satori。
- SEOへの変更: URL・slug・記事タイトル・H1・記事本文は無変更。canonical は「誤って / を指していたページ」を自己参照に修正したのみ（既存の正しいcanonicalは無変更）。og:locale/siteName/url/authors/section、カテゴリページのOGを追加。sitemapに /privacy と /types/* を追加、カテゴリのlastModifiedを記事の最新更新日に。robotsのdisallow修正。/articles の description に「雑記」を追記。ホームのPICKUPラベルをh2化。ガイド・会員ページのtitle重複修正。記事のFAQPage構造化データから、画面に表示されていないインラインFAQ（agent-not-recommended の1件）を除外。
- 既知の問題: agent-not-recommended.md の inlineFaq.heading「「やめたほうがいい」と感じた瞬間は、正直あった」に一致するH2が無く表示されない（記事側の修正が必要）。/members/resume-template のリンク先 `/members/files/resume-template-naru.docx` が存在しない。Google Fontsを afterInteractive のスクリプトで読み込んでおりFOUT/CLSが出る（next/font移行はビルド時の外部取得を伴うため未実施）。internal ダッシュボードのlint警告は対象外として未修正。
- 判断が必要な項目（NEEDS_DECISION）:
  1. ブランドカラー: 依頼文の Tea Green #1F6F66 / Amber #B5691B と、現行サイトCSSの primary #7A3E2E（ブラウン）/ amber #D29A4A が一致しない（画像生成プロンプトは前者）。「ブランドカラー変更禁止」と矛盾するため配色は変更していない。どちらを正とするか決定が必要。
  2. /shindan/result/* と /types/* が同じ16タイプを扱い内容が重複。result を noindex か /types へのcanonicalにするか。
  3. 未参照のpublic画像（logo-icon.png、logo-wordmark-original.png、images/backgrounds/*、shindan の未使用素材、monster-*.png など）。外部参照の可能性があるため削除していない。
  4. 記事内の `cta-button` を内部リンク（エージェント比較を見る等）にも使っており cta_click 計測に混ざっている。計測仕様の変更になるため未変更。
- 推奨する次の作業: 上記判断事項の決定、next/font への移行検討、agent-not-recommended の inlineFaq 見出し修正、resume-template の docx 配置、PR作成とPreviewでの目視確認。

---

## REPORT-008 — 未定義カテゴリ「転職ノウハウ」の修正と「雑記」カテゴリ追加

- reportId: `REPORT-008`
- completedInstructionId: `USER-ARTICLE-CATEGORY-FIX-2026-10-01`（ユーザー直接依頼。INST-004は未着手のまま）
- status: `DONE`
- branch: `claude/article-tag-fix-c7w0z4`
- 実施内容: 記事 `new-grad-early-resignation-career-plan` に未定義カテゴリ「転職ノウハウ」が入っていたため、新カテゴリ「雑記」（`/category/zakki`）を追加して主カテゴリを雑記に変更。frontmatterに任意項目 `subCategories` を追加し、同記事を「業界解説」にも掲載。カテゴリページ・記事一覧の絞り込み・関連記事は `ArticleMeta.categories`（主カテゴリ＋subCategories）で判定する。ナビ・タグ色（新色 sage）・パンくずに雑記を追加。SEO Editor / Article Factory のカテゴリ許可リストにも雑記を追加。
- テスト結果: `npm test` 261件pass、`npx tsc --noEmit` exit 0、変更ファイルのESLint エラー0（既存warning 1件）、`npm run build` 成功。ビルド出力で同記事が `/category/zakki` と `/category/industry-guide` の両方に出ることを確認。
- 変更ファイル: `content/articles/new-grad-early-resignation-career-plan.md`, `src/lib/articles.ts`, `src/lib/categories.ts`, `src/app/category/[slug]/page.tsx`, `src/app/articles/[slug]/page.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/ArticleBrowser.tsx`, `src/components/ArticleCard.tsx`, `src/components/ArticleList.tsx`, `src/components/CategoryNavBar.tsx`, `src/lib/article-factory/constants.ts`, `src/lib/article-factory/safety.test.ts`, `src/lib/seo-editor/markdown.ts`, `src/lib/seo-editor/schemas/write.ts`, 本レポート。
- git diff概要: カテゴリ定義・型の拡張、複数カテゴリ掲載（subCategories）対応、該当記事のfrontmatter修正。safety.testの「未知カテゴリ」例を「転職ノウハウ」に変更。
- 既知の問題: Article Factory の候補生成でもAIが「雑記」を選べるようになった。SEO Editor / Article Factory はまだ `subCategories` を生成・編集しない（手動で設定）。
- 判断が必要な項目: 雑記カテゴリの説明文・FAQ・色（#5E7F68）は仮置きのため必要に応じて調整。
- 推奨する次の作業: masterへのPR作成・レビュー後にマージ。

---

## REPORT-007 — 記事画像4枚のDrive受け渡し

- reportId: `REPORT-007`
- completedInstructionId: `USER-TWO-TOUCH-2026-09-24`
- status: `BLOCKED`（新規記事PRでの画像受領から公開まで未検証）
- branch: `feature/article-factory-two-touch-flow`
- pr: `#21`（Draft、master未マージ）
- 実施内容: 記事ごとのDriveに `image-prompts.md` と `images/` を用意する手順、4枚のWebP変換・メタデータ除去・上書き防止、生成画像プランのDrive案内を追加。PR作成イベントによる受け渡し準備と、Openな記事PRのDrive画像を定期確認するタスクを設定した。記事38の既存Drive画像1枚について読み取り可能なファイル参照を確認。
- テスト結果: `npm test` 232件pass、`npx tsc --noEmit` exit 0、変更したJS/TSファイルのESLint exit 0。PR #21のVercel commit statusはsuccess。
- 変更ファイル: `docs/article-factory-two-touch.md`, `docs/article-factory.md`, `package.json`, `scripts/prepare-article-images.mjs`, `scripts/prepare-article-images.test.mjs`, `src/lib/article-factory/markdown.ts`, `src/lib/article-factory/markdown.test.ts`, 本レポート。
- git diff概要: 画像準備スクリプトとテスト、画像プランとDrive手順の更新、運用結果の記録。記事本文と本番設定は無変更。
- 既知の問題: 画像4枚のDriveダウンロード→バイナリPR書き込み→Preview実ブラウザ監査→Production確認は実記事で通し検証していない。定期確認は最大毎時であり、Drive webhookやVercel Workflowへの無人連結ではない。作業ブランチは本番へ未反映。
- 判断が必要な項目: 次の記事PRでの実測前に安全ゲートを緩めないこと。Draft PRのレビューと統合は別途必要。
- 推奨する次の作業: PR #21のレビュー、実際の次の記事でDrive画像4枚を使う経路を検証し、失敗箇所を修正する。全ゲートの成功が確認できるまで自動公開完了と報告しない。

---

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

## REPORT-SHINDAN-MERGE-20260928
- completedInstructionId: user-request-shindan-redesign-and-merge
- status: VERIFIED_READY_FOR_MERGE
- branch: feat/naru-rpg-quiz-redesign
- Changes: replace 10 four-choice questions with 20 YES/NO questions mapped to 16 classes; original generated character atlas and RPG title; NARU parchment/burgundy/gold theme; responsive title, quiz, archive and results; local Lato/Noto font subsets; reduced-motion support; retain result links, disclosures and analytics.
- Files: src/app/shindan/**, src/app/page.tsx (quiz count only), public/shindan/quest-classes-v2.webp, public/shindan/quest-logo-v5.webp, public/shindan/fonts/*quest-v3.woff2 and licenses, scripts/sync-shindan-fonts.mjs, this report.
- Diff: scoped quiz replacement plus font/asset additions. No article drafts, unrelated image modifications, or unused generated party artwork included.
- Validation: applied cleanly to latest master b2ef394; full production build (webpack) passes, including TypeScript and 119 static pages. Diagnosis tests 4/4 pass via configLoader runner (default esbuild config loading hits Windows parent-directory ACL). Previously verified 20-question completion, retry, 16 reachable outcomes and 320/390/768/1440px layouts. Targeted ESLint passed.
- Known issues: non-blocking existing Next middleware deprecation and webpack cache snapshot warnings. Original working checkout Git metadata remains unwritable; merge uses the GitHub connector and a separate clean validation checkout. Shared OG artwork retains its existing design.
- Decisions: user explicitly requested merge; this supersedes earlier no-publish instructions for the merge operation.
- Next: create scoped PR and merge after checking GitHub status. No separate deployment operation requested.
