# 画像プラン（画像受領後・確定配置）

- 記事ID: 39
- slug: `second-new-grad-it-interview-questions`
- ソースファイル: `content/articles/second-new-grad-it-interview-questions.md`
- 対象PR: #22
- 画像4枚: 受領・目視監査・WebP変換済み。元PNGはDriveのimages/に保存。
- ユーザーに案内した記事生成前の暫定プロンプト `image-prompts-preliminary.md` を優先して作られた画像のため、PR作成後の初期画像プランとはテーマが異なる。完成画像の内容と記事の見出しに合わせ、誤配置しないよう確定した。

## 実装済み画像と配置

| 画像 | 用途 | 出力サイズ | 本文内の配置 |
|---|---|---|---|
| `second-new-grad-it-interview-questions-card.webp` | 記事一覧、記事上部、OG画像（既存slug規約による自動参照） | 1200×630 | 自動参照 |
| `second-new-grad-it-interview-questions-01.webp` | 質問の意図を考える：経験・志望理由・これから | 1200×675 | H2「よく聞かれる質問と具体的な答え方（Q&A形式）」の導入説明直後 |
| `second-new-grad-it-interview-questions-02.webp` | 答えを組み立てる：結論・具体例・入社後 | 1200×675 | H2「面接当日のマナーと伝え方のコツ（声の出し方・話す順序）」内の回答構成説明直後 |
| `second-new-grad-it-interview-questions-03.webp` | 面接前の確認メモ：応募先の仕事内容・自分の経験・確認したいこと | 1200×675 | H2「面接前チェックリスト（応募約30社を効率的に回すための実務リスト）」の導入説明直後 |

## 受領・品質確認

- 元画像の保存先: https://drive.google.com/drive/folders/180USAvx8TEXxSy-IRn-dw2AJIWiYpsOa
- アイキャッチ1枚・本文画像3枚、各画像の日本語・見切れ・透かし・ロゴ・不正確な数値を目視確認。
- EXIF・XMP等の埋め込みメタデータを削除してWebPへ変換。
- 記事本文に各画像の内容を示すaltを付与。
- 自動公開の前に変更後PRのCI・Vercel Previewと実表示を再監査すること。
