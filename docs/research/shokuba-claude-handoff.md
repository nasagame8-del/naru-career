# NARU Research｜Claude Code 引き継ぎ｜しょくばらぼ × 採用ページ

## 目的

NARUの独自記事用データ基盤を作る。

厚生労働省「しょくばらぼ」の公式全件CSVを母集団として、情報通信業の企業データと、公開されている採用ページの情報を構造化し、「第二新卒×IT/Web転職」で独自集計できるテーマを発見する。

これは記事公開作業ではない。調査・データ整備・分析までで止める。

## 現在地

作業ブランチ:

`research/shokuba-20261004`

Draft PR:

https://github.com/nasagame8-del/naru-career/pull/143

既にあるファイル:

- `scripts/research-shokuba.py`
- `scripts/research-recruitment-pages.py`
- `data/research/shokuba/2026-10-04-summary.json`
- `data/research/shokuba/2026-10-04-information-communications-seed.csv`
- `.github/workflows/shokuba-research.yml`

第一段階の実測値:

- しょくばらぼ全件: 152,392行
- 列数: 634
- 情報通信業: 8,118社
- 企業HP URLあり: 3,513社
- 採用ページURLあり: 196社
- 研修制度の有無を開示: 275社
  - 有: 238
  - 無: 37
- メンター制度の有無を開示: 274社
  - 有: 168
  - 無: 106
- 自己啓発支援制度の有無を開示: 276社
  - 有: 212
  - 無: 64
- キャリアコンサルティング制度の有無を開示: 274社
  - 有: 129
  - 無: 145
- 35歳未満の採用・離職データについて、採用数>0かつ両方取得できる行: 96社

注意:
「35歳未満の離職者数 ÷ 採用者数」はコホート定着率ではないため、絶対に「定着率」と呼ばないこと。

## Claude Codeにやってほしいこと

### 1. 現状確認

最初に必ず以下を読む。

- このファイル
- `scripts/research-shokuba.py`
- `scripts/research-recruitment-pages.py`
- `data/research/shokuba/2026-10-04-summary.json`
- `data/research/shokuba/2026-10-04-information-communications-seed.csv`
- `01_MASTER_PROMPT_記事選定から公開まで.md` がリポジトリに存在する場合はその運用思想も確認

既存成果物を作り直さず、不足工程だけ進める。

### 2. 採用ページ196件の取得

`scripts/research-recruitment-pages.py` を実行し、必要なら修正する。

制約:

- しょくばらぼに明示された公開採用URLだけを対象にする
- robots.txt の明示的な拒否に従う
- ログイン回避、CAPTCHA回避、bot対策回避をしない
- JavaScriptブラウザ自動操作は原則使わない
- 取得間隔・並列数を常識的に抑える
- HTML全文を成果物として保存しない
- 求人本文の転載をしない
- HTTP 403/429などは「取得不可」として記録し、突破しない
- Indeed、求人ボックス、OpenWork、転職会議など第三者プラットフォームへ横展開して大量スクレイピングしない

### 3. 採用ページを構造化

最低限、企業ごとに次を構造化する。

- corporateNumber
- company
- sourceUrl
- finalUrl
- httpStatus
- pageTitle
- fetchedAt
- secondNewGrad
- inexperienced
- recentGraduate
- potentialHire
- training
- mentor
- remote
- fullRemote
- engineer
- webMarketing
- webDirector
- portfolio
- practicalExperience
- salaryMention
- JobPosting JSON-LDの有無
- JobPosting title（取得できる場合）

可能なら、明示的に読み取れる範囲だけ追加:

- 職種名
- 年収下限
- 年収上限
- 必須経験年数
- 必須スキル
- 歓迎スキル
- 雇用形態
- 勤務地

推測で補完しない。
不明はnull。

### 4. データ品質を確認

必ず以下を確認する。

- 同一企業・同一URLの重複
- リダイレクト先
- 採用ページではなくトップページ/サービスページになっているURL
- 古い新卒採用ページ
- 404
- robots block
- 403/429
- JavaScript依存で本文が取れないページ
- 第三者求人サイトへのリンク

第三者求人サイトは、URLと「第三者サイトだった」という事実だけ残し、追加クロールしない。

### 5. 独自記事に使える集計を出す

母数を必ず併記し、欠損を無視して全8,118社の割合のように見せない。

優先して出す集計:

1. 情報通信業8,118社のうち、若手採用・育成情報をどの程度開示しているか
2. 研修制度を開示している企業の「あり/なし」
3. メンター制度
4. 自己啓発支援
5. キャリアコンサルティング
6. 35歳未満の採用実績データ
7. 採用ページ196件のうち、第二新卒・未経験・既卒・ポテンシャル採用への言及
8. 採用ページ196件のうち、研修・リモート・ポートフォリオ・実務経験への言及
9. JobPosting構造化データを持つ採用ページの割合
10. 企業規模別に開示率や制度有無に差があるか

### 6. 「記事にできるか」を評価

次の基準でテーマ候補を5〜10件出す。

- NARUの第二新卒×IT/Web読者に直結する
- 母数が十分ある
- 数字の定義が誤解されにくい
- 既存の一般論記事では出せない
- 2026年データとして更新価値がある
- SEOタイトルに自然に落とせる
- 独自データを本文冒頭に置ける

候補ごとに:

- 仮タイトル
- 読者の疑問
- 使用する母数
- 使える指標
- 数字を出す際の注意
- 既存NARU記事との内部リンク候補
- 独自性スコア 1〜5
- 記事化優先度 1〜5

を出す。

### 7. 成果物

以下を作成する。

- `data/research/shokuba/2026-10-04-recruitment-pages-pilot.json`
- `data/research/shokuba/2026-10-04-recruitment-pages-pilot.csv`
- `data/research/shokuba/2026-10-04-analysis.json`
- `docs/research/shokuba-2026-10-04-report.md`

reportには最低限:

- データソース
- 取得日時
- 母集団
- 取得成功/失敗数
- 欠損率
- クロール制約
- 主な集計結果
- 誤解しやすい指標
- 記事候補
- 次のデータ取得案

を残す。

## 禁止

- masterへ直接pushしない
- PRをmergeしない
- 記事公開しない
- OpenAI APIを使わない
- Anthropic APIキー課金を使わない
- 有料データAPIを使わない
- 数値を推測しない
- 未取得データを「0」と扱わない
- 相関を因果関係として書かない
- 「採用者数-離職者数」をそのまま定着率としない
- 第三者サイトの利用規約やアクセス制御を回避しない

## 完了条件

1. 採用URL対象のクロール結果が保存されている
2. 取得成功数・失敗数・理由が明示されている
3. 欠損を考慮した集計がある
4. 記事候補5〜10件がデータから導出されている
5. 再実行可能なスクリプトになっている
6. 実行したコマンドとテスト結果をreportに記録
7. PR #143へpushして止まる

最後に、チャットでは次だけ報告する。

- 取得対象数
- 取得成功数
- 重要な発見TOP5
- 一番強い記事案TOP3
- 変更ファイル
- PR #143の最新head SHA
- 未解決の問題
