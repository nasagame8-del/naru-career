# NARU画像のAI来歴・透かし監査（2026-10-12）

## 前提

- C2PA / EXIF / XMP / IPTC はファイルに付随する情報。既存の Sharp WebP 変換はこれらを保存しない設定だが、個々の本番配信画像を実測した結果ではない。
- SynthID は画素に埋め込まれる不可視の来歴信号。WebP変換、圧縮、メタデータ削除後も残る可能性がある。ファイルの拡張子やメタデータの有無だけでは判定できない。
- Googleの検索順位が「SynthID検出＝一律減点」になる公式ルールは確認されていない。画像の出所、内容の正確さ、編集責任を明瞭にする。
- 検出されない場合も「人間が描いた」と断定しない。古い生成モデルや変換で信号が失われる場合がある。

## 監査ツール

```bash
# インターネット接続・APIキー不要。記事画像のローカル・メタデータ項目を走査
node scripts/audit-image-provenance.mjs --output reports/image-provenance-metadata.json

# 最新の記事1本（4枚等）をOpenAI公式のC2PA / SynthID APIで検証
# キーは環境変数。標準出力・レポートに書かない
OPENAI_API_KEY=... node scripts/audit-image-provenance.mjs \
  --slug contractor-bank-transfer-fee-deduction \
  --verify --output reports/image-provenance-073.json
```

- `--verify` を付けたときだけ、対象の画像ファイルをOpenAIの Content Provenance APIにアップロードする。
- `--slug` で対象記事を指定。大量の検査前は少数の記事でAPIの権限・費用・レート制限を確認する。
- `--limit N` で対象ファイル数を制限できる。
- JSONレポート内の `synthid: "not_checked"` は未検査、`outcome: "not_detected"` は対応信号未検出であり、同義ではない。
- OpenAIの検査は対応するOpenAI由来の信号に限られる。他社生成物の確認には [Google SynthID Detector](https://synthid.com/) も検討する。
- APIの401/404/429やネットワークエラーは判定結果として扱わず `error` に記録する。
- 画像そのものは変更しない。透かしの削除・回避処理は組み込まない。

## 画像の制作方法・キャプション

1. ChatGPTなどで制作したイラストであると制作記録から確かめられたときだけ、「NARU制作のイメージイラスト（AIを使用）」と表示する。
2. 官公庁の資料、引用した画像、画面キャプチャ、写真、一次データを含む図解には、一律のAI生成ラベルを付けない。原典・調査主体・加工内容を個別に記す。
3. 素材の制作方法が未確認の場合は断定せず、確認が終わるまで元データの来歴確認を優先する。
4. 画像の説明文（alt）は内容を伝えるために維持し、出典・制作注記はキャプションに分離する。
5. 元のC2PAを残すべき画像は正本の保存方針を見直す。編集済みの複製は元画像との対応を制作台帳に記録する。

## 現段階の制約

2026-10-12時点、この作業からGoogle/OpenAIの検出APIへの実ファイル送信・検出結果の取得は完了していない。実ファイルを取得し、検証ツールを実行するまでは「透かしあり／なし」を公表しない。

参照：Google 2026-10-07 発表 https://blog.google/innovation-and-ai/models-and-research/google-deepmind/synth-id-ai-content/ 、OpenAI Content Provenance API https://developers.openai.com/api/docs/guides/content-provenance 、Google Search Central https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
