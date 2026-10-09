# NARU Research｜Claude Code 指示｜3,419社フルラン

## 目的

300社パイロットでStage 4の採用ページDiscoveryに拡大価値が確認できたため、
情報通信業 × 企業HPあり母集団からホスト重複等を除外した **3,419社** を対象に
Stage 4 Discoveryを全件実行する。

Stage 5も全件実行してよいが、現時点では求人単位化精度に未解決課題があるため、
求人レコードは **provisional（暫定）** として保存し、Discoveryの正式結果と混同しない。

masterへのmerge、記事作成、公開は禁止。

---

## 現在地

- Repository: `nasagame8-del/naru-career`
- Branch: `research/shokuba-20261004`
- Draft PR: #143
- 開始時点の確認対象head SHA: `b2ef6e444b41ac4fa7a738ddb58ce61bdd430a14`

最初に必ず最新headを再取得し、上記SHAから進んでいる場合は最新成果物を読み直すこと。

既存の300社パイロット成果物は削除・上書きしない。

---

## 0. 開始前に読むもの

必ず以下を読む。

- `docs/research/shokuba-2026-10-04-stage4-5-report.md`
- `docs/research/shokuba-2026-10-04-report.md`
- `scripts/research-web.mjs`
- `scripts/research-discover-recruitment.mjs`
- `scripts/research-jobs.mjs`
- `scripts/research-jobs.test.mjs`
- `scripts/research-stage45-analysis.mjs`
- 300社パイロットの discovery / jobs / analysis JSON・CSV

既存の既知バグ:
- 「勤務地：東京都渋谷区」から京都府を生成していた部分一致
- 「Recruit 採用情報」を求人名にしていた
- `isJobLevelRecord` 判定順に改善余地
- 1求人=1レコード達成度53.6%

これらを無視して「求人精度が高い」と報告しない。

---

# Stage 4｜3,419社 全件Discovery

## 対象

300社サンプルを作った元の層化可能母集団から、
ホスト重複除外後の **3,419社すべて**。

対象リストを実行前に固定し、件数が3,419社であることをassertする。
件数が異なる場合は勝手に続行せず、差分理由をレポートする。

## Discoveryルール

300社パイロットと同じ安全条件を維持する。

許可:
- 企業がしょくばらぼに登録したHP URL
- 登録URLのoriginへの1回だけの正規化フォールバック
- 企業公式HP内リンク
- robots.txt
- sitemap
- sitemap内の採用関連URL
- 企業公式サイトから直接リンクされた公式ATS

採用関連語:
- 採用
- 採用情報
- 求人
- 募集
- 新卒
- 中途
- キャリア採用
- 第二新卒
- recruit
- recruiting
- career
- careers
- jobs
- hiring
- entry

禁止:
- URL総当たり
- Google/Bing検索結果の大量クロール
- CAPTCHA回避
- bot対策回避
- robots.txt明示Disallow無視
- 403/429突破
- Indeed / 求人ボックス / OpenWork / 転職会議等の横断クロール

## 保存項目

企業単位で最低限:

- corporateNumber
- company
- employeeBand
- prefectureBand
- populationWeight
- homepageUrl
- normalizedOriginFallbackUsed
- recruitmentUrl
- finalUrl
- discoveryMethod
- discoveryAnchor
- hostCategory
- confidence
- httpStatus
- robotsStatus
- redirects
- fetchedAt

confidence:
- high
- medium
- low

**正式Discovery集計には high / medium のみ使用。**
lowは保存するが自動採用しない。

---

# Stage 5｜求人抽出フルラン（暫定）

Stage 4で high / medium と判定した採用ページを対象に実行してよい。

ただし成果物・レポート上で明確に
`provisional: true`
とする。

## 重要

現状のStage 5は「1求人=1レコード」精度が未完成。
したがって、

- 求人件数
- 第二新卒率
- 未経験率
- 年収掲載率
- リモート率
- ポートフォリオ率

を**確定値として記事化できる数字**とは扱わない。

今回は全件でどの程度のデータ量が取れるかを把握するためのスナップショットとする。

## 可能ならこのラン前に最低限修正

既知の2バグは必ず修正した状態で走らせる。

1. 都道府県部分一致バグ
2. サイト見出し `Recruit 採用情報` 等をjobTitleにする誤判定

`isJobLevelRecord` の判定順も、
既存テストと実データを確認して明らかに安全な修正なら反映してよい。

大規模な再設計でフルラン開始が止まる場合は、
Stage 4を先に完走し、Stage 5を別工程として続ける。

## 求人上限

300社パイロットの1社8件上限は拡張する。

今回:
- 1社最大20求人
- 20件に到達した企業は `truncated=true`
- 実際に20件到達した企業数を報告
- 上限により欠落した可能性を明記

---

# 出力ファイル

300社パイロットを絶対に上書きしない。

新規で例:

- `data/research/shokuba/2026-10-04-discovery-full-3419.json`
- `data/research/shokuba/2026-10-04-discovery-full-3419.csv`
- `data/research/shokuba/2026-10-04-jobs-full-3419-provisional.json`
- `data/research/shokuba/2026-10-04-jobs-full-3419-provisional.csv`
- `data/research/shokuba/2026-10-04-full-analysis.json`
- `docs/research/shokuba-2026-10-04-full-run-report.md`

必要ならcheckpointを
`data/research/shokuba/checkpoints/`
に置いてよい。

---

# 再開可能性

3,419社を一発で最後までメモリ保持しない。

必ずcheckpoint / resume可能にする。

最低条件:
- corporateNumber単位で完了管理
- 中断後に取得済み企業を再リクエストしない
- 同一URLを重複クロールしない
- JSON/CSV破損を避けるためatomic write
- 途中失敗でも進捗件数が分かる

既存成果物がある場合はresumeし、0からやり直さない。

---

# レート・安全条件

300社パイロットと同等かそれより保守的にする。

- 同一hostは直列
- hostごとに最低1.5秒間隔
- 全体concurrencyは8以下
- 429が出たhostは即停止または大幅backoff
- 403は突破しない
- robots blockはクロールしない
- TLSエラーを無効化して突破しない
- HTML全文を成果物へ保存しない
- 求人本文全文を転載しない

もし429が全体で複数発生する場合はconcurrencyを落とす。

---

# Stage 4で必ず集計するもの

全3,419社について:

1. HP取得成功数
2. origin fallback使用数 / 追加成功数
3. 採用ページ発見数
4. high / medium / low
5. 発見なし
6. 自社ドメイン / ATS / その他 / 第三者求人媒体
7. robots block
8. 403 / 404 / 429 / 5xx / TLS / DNS
9. リダイレクト数
10. 地域別発見率
11. 企業規模別発見率
12. 加重発見率
13. しょくばらぼの採用ページURL記載企業との比較
14. 実行時間
15. 総HTTPリクエスト数

---

# Stage 5で必ず集計するもの

provisionalであることを明記して:

1. 求人詳細まで到達した企業数
2. 求人レコード総数
3. 1社あたり中央値 / 平均 / 最大
4. 20件上限到達企業数
5. 第二新卒
6. 未経験
7. 既卒
8. 実務経験
9. 研修
10. remote
11. full remote
12. portfolio
13. 給与記載
14. 年収下限/上限が構造化できた件数
15. 必要経験年数が取れた件数
16. JobPosting JSON-LD件数
17. job titleとして怪しいレコード件数
18. category/containerらしいレコード件数
19. 重複候補数

求人単位の割合を出す場合は、
必ず `provisional` と表記する。

---

# 品質チェック

最低限:

- unit test全件
- 300社パイロットで直した既知バグの再発なし
- corporateNumber重複チェック
- 同一URL重複チェック
- nullを0/falseに変換していない
- 300社パイロット成果物が変更されていない
- Stage 4正式結果とStage 5 provisionalを混同していない

---

# 記事候補

全件Discovery完了後、
**Stage 4の確定データだけ**でまず記事候補を5〜10件出す。

Stage 5の数字を使った記事候補は
`provisional candidate`
として別枠にする。

特に確認したいテーマ:

- IT企業は公式採用ページをどの程度持っているか
- 企業規模と採用ページ整備率
- 地域差
- 国DBに採用URLを登録していないのに実際には採用ページがある割合
- 登録HP URLの劣化率
- 公式ATS利用率
- 第二新卒の明示率（provisional）
- 未経験の明示率（provisional）

---

# 完了条件

1. 3,419社すべてについてStage 4が完了または明示的失敗として記録
2. high/medium/low/noneの合計が3,419
3. Stage 4正式分析JSONが生成
4. Stage 5実行可能分を完了しprovisionalとして保存
5. resume/checkpointが機能
6. テスト成功
7. 300社パイロット成果物を保持
8. PR #143へcommit/push
9. masterへmergeしない
10. 記事作成・公開しない

---

# 最後の報告形式

チャットでは次だけ報告する。

1. Stage 4: 3,419社の完了数
2. 採用ページ発見数 / 発見率 / 加重発見率
3. high / medium / low / none
4. HP取得失敗・robots・403・404・429等
5. Stage 5: 求人到達企業数
6. provisional求人レコード総数
7. 第二新卒 / 未経験 / 実務経験など主要件数
8. 1社あたり求人中央値・平均・最大
9. 重要な発見TOP10
10. 記事化できる確定テーマTOP5
11. provisionalテーマTOP5
12. 実行時間 / HTTPリクエスト数
13. 変更ファイル
14. PR #143 最新head SHA
15. 残課題

以上を実行し、PR #143へpushしたら停止する。
