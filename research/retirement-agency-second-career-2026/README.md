# 退職代行と第二新卒の「次の転職」 — NARU独自調査（2026-10-07）

退職代行サービスの市場を独自に集計し、
「会社を辞めることは外注できるようになった。しかし次の会社を選ぶことまで外注できるようになったのか」
という問いにデータで答えるための基礎資料。

**これは調査データであり、記事ではない。** 記事化の前に `reports/limitations.md` を必ず読むこと。

---

## 結論を3行で

- 母集団58サービス中、営業継続を確認できたのは44件（判定済53件中）。**書面で確認できた倒産は1件のみ**で、「消えた」の実体は倒産ではなく**確認不能化**である。
- 退職後のキャリア支援を持つのは判定済32件中15件。**自社で求人紹介まで行うのは3件**。弁護士法人運営12件のうち退職後支援を持つのは1件。
- **「第二新卒」を対象として明示するサービスは0件**（訴求文言を確認できた35件中。2024・2025年のアーカイブ42件でも0件）。

---

## 読む順番

1. `reports/findings.md` — 調査結果。section 20 の10の問いに回答
2. `reports/second_new_grad_implications.md` — 第二新卒読者にとっての意味
3. `reports/limitations.md` — **言えないことの一覧。記事化前に必読**
4. `reports/methodology.md` — 調査方法と判定基準
5. `reports/fact-check.md` — 各数値の根拠と、調査中に見つけて直した誤り
6. `analysis/article-ready-metrics.json` — 記事で使える10指標（分母・定義・注意付き）

---

## ディレクトリ構成

```
raw/                              収集した生データ（出典URL付き）
  discovered_services_batch_*.csv   4系統の探索結果（比較サイト／運営形態別／新規参入／手動）
  discovered_services.csv           上記を統合した全行（1行=サービス×出典）
  alias_map.csv                     名寄せの判断（CONFIRMED / PROVISIONAL / REJECTED と根拠）
  scope_exclusions.csv              退職代行ではないと判断したものと理由
  liveness_checks.csv               生存確認・リダイレクト・アーカイブ有無
  url_discovery.csv                 中継リンクしかなかったサービスの公式URL調査
  service_fields_batch*.csv         各社の訴求内容・料金・運営形態（公式サイト・特商法ページ）
  corporate_lookup.csv              法人番号の照合（住所一致まで確認）
  archive_snapshots.csv             2024・2025年のアーカイブ内容
  archive_scope_notes.csv           アーカイブが退職代行LPでない場合の注記
  market_exit_events.csv            倒産・終了告知・法的措置・外部調査

normalized/
  services.csv                      サービス単位の統合データ（section 17 の列）
  operators.csv                     運営法人単位
  evidence.csv                      主要データの出典（149行）
  service_candidates.csv            名寄せ後の候補一覧
  service_id_registry.csv           service_id の固定表（削除すると突合が壊れる）

analysis/
  overall_status.csv                営業状態の分布
  survival_by_operator.csv          運営形態別（※生存バイアスの警告列あり）
  survival_by_price.csv             価格帯別（最終観測価格ベース＋2026年のみの参考値）
  survival_by_launch_year.csv       参入年別（ほぼ全件UNKNOWN。設立年未取得のため）
  career_support.csv                退職後支援の型別
  second_new_grad_support.csv       第二新卒・若手向け訴求と支援項目
  price_change.csv                  同一サービス内の価格変化
  cross_analysis.csv                クロス集計
  summary.json                      集計サマリ＋仮説H1〜H8の判定＋外部比較
  data_quality.json                 データ品質指標
  article-ready-metrics.json        記事で使える指標（分母・定義・注意付き）

reports/                          レポート5本
tools/                            再実行用スクリプト（Node、外部APIキー不要）
```

---

## 再実行

```bash
node tools/merge-discovered.mjs    # 探索結果を名寄せして母集団を確定
node tools/check-liveness.mjs      # 生存確認とアーカイブ有無（ネットワークアクセスあり）
node tools/build-normalized.mjs    # normalized/ を生成し営業状態を判定
node tools/analyze.mjs             # analysis/ を生成
```

`check-liveness.mjs` は実行時点のサイト状態に依存するため、再実行しても同じ結果にはならない。
各レポートの基準日と `liveness_checks.csv` の `checked_at` を参照すること。

---

## データの読み方（重要）

### 1. 空欄は0ではない

全フィールドで3状態を維持している。

- `true` = 記載を確認した
- `false` = 該当ページを読んだうえで記載がないことを確認した
- 空欄 = 確認できなかった

**割合の分母は「判定できた件数」で、母集団58件ではない。** 判定済件数はフィールドごとに28〜35件と異なる。

### 2. 「停止」は倒産ではない

`status_2026 = STOPPED` のほとんどは、ドメインの名前解決失敗やHTTP 404という**観測**である。
倒産の証拠ではない。倒産は `bankruptcy` 列が `true` の1件のみで、登記記録の閉鎖は0件。

### 3. 運営形態別・価格帯別の継続率を使ってはいけない

属性はサイトが生きている間しか読めないため、属性が判明したサービスは定義上すべて生存者になる。
`survival_by_operator.csv` の各行には警告列を付してある。仮説H3・H6は検証不能である。

### 4. 検証不能は「否定された」ではない

8仮説のうち支持できたのはH7のみ、一部支持がH1、弱い証拠がH4、**4つ（H2・H3・H5・H6）は検証不能**。
データが足りないことと、仮説が誤っていることは別である。

---

## 外部調査との関係

NARU独自母集団（58件）を先に構築し、比較は最後にのみ行った。数値を合わせる調整はしていない。

| | NARU | 帝国データバンク |
|---|---|---|
| 対象 | 58サービス | 52事業者 |
| 継続なし | 9件（17.0%、判定済53件中） | 14件（26.9%） |
| 基準日 | 2026-10-07 | 2026-09 |
| 判定不能の分離 | する（5件） | 公表なし |

差の大きな部分は判定不能の扱いで説明できる。5件を全て停止に入れると 14/58 = 24.1% となる。
詳細は `reports/findings.md` 第11節。

---

## 禁止事項

このデータで書いてはいけないことを `reports/findings.md` 第14節に列挙した。主なものは以下。

- 「退職代行が相次いで倒産している」— 確認できた倒産は1件
- 「安い退職代行から潰れた」— 価格と継続の関係は検証不能
- 「弁護士系は生き残り民間系は消えた」— 生存バイアスの産物
- 「退職代行を使うと転職で不利になる」— 利用者の転職結果は追跡していない
- 「退職代行は退職後を一切見ない」— 民間14件中11件は何らかの支援を掲げる

---

## クロール時の遵守事項

- robots.txt の明示的な拒否に従った
- HTTP 403 / 429 を突破していない。TLS検証を無効化していない
- CAPTCHA・bot対策の回避を行っていない
- 同一ホストは直列、ホストごとに2秒間隔、全体の同時実行は4
- HTML全文を成果物として保存していない
- Indeed・求人ボックス・OpenWork等の第三者プラットフォームへ横展開していない
- 有料API・OpenAI API・Anthropic APIキー課金を使用していない
