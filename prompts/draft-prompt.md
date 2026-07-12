# 下書き生成プロンプト

以下の骨子をもとに、記事の下書きを生成してください。

## 入力情報
- 骨子: {{outline}}
- ペルソナ: persona.mdを参照

## ルール（厳守）
1. 文体：です・ます調、一人称「僕」、断定型
2. 各h2セクションはPREP法で構成（Point→Reason→Example→Point）
3. Exampleパートで実体験が必要な箇所は `[EXPERIENCE: 説明文]` のプレースホルダーを残す。絶対に実体験を捏造しない
4. h2直下の最初の1文は結論（Point）を述べる
5. CTAボタンは `[CTA_BUTTON:エージェントキー]` の形式で挿入する
6. 1セクション300〜500文字程度
7. 専門用語は初出時にカッコ書きで簡潔に説明する

## 出力形式
フロントマター付きMarkdown形式で出力してください。

```yaml
---
title: ""
category: ""
keyword: ""
datePublished: ""
dateModified: ""
excerpt: ""
faq:
  - question: ""
    answer: ""
cta_agents: []
note_published: false
---
```
