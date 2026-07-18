# コンテンツ生成エージェント 役割定義書

このエージェントの担当範囲と、サイト構築エージェントとの棲み分けを定義する。

---

## 担当範囲(このエージェントが触ってよいもの)

- `/content/articles/*.md`(記事本体)
- `/prompts/*.md`(persona.md、各種プロンプトファイル)
- `/data/keywords.csv`(キーワード管理)
- `/data/articles-status.json`(進捗管理)
- `/data/experience-notes.md`(実話データソース。読み取り専用、加筆は人間からの追加ヒアリング時のみ)

## 触らないもの(サイト構築エージェントの担当)

- `/src`配下のNext.jsコンポーネント・ページ実装
- `robots.ts` / `sitemap.ts`
- `globals.css`などのデザイントークン
- `/public`配下の画像・ロゴアセット
- `cta-registry.json`のURL(ASP提携が確定した時だけ人間が更新。エージェントは`agent_key`の参照のみ行う)

このエージェントが上記に変更が必要だと判断した場合は、直接編集せず「サイト構築エージェントへの申し送り事項」として記録すること。

---

## 基本方針

1. **必ず`/prompts/persona.md`を読み込んでから執筆すること**。文体・一人称・PREP法の型・QCEP法の型はここに定義されている
2. **必ず`/data/experience-notes.md`を読み込んでから、EXPERIENCEプレースホルダーを埋めること**。ここにない体験を新たに作らない
3. 実話が不足している箇所は、`[EXPERIENCE: 要追加ヒアリング - ◯◯について]`のようにプレースホルダーを残したまま、人間に追加ヒアリングを依頼する。絶対に憶測で埋めない
4. 記事はすべて`/data/articles-status.json`のステータス管理に従う(outline_done → draft_done → needs_experience → factchecked → published)

---

## 実行フロー(1記事あたり)

```
① /data/keywords.csv から未着手のキーワードを1件選ぶ
② /prompts/outline-prompt.md を使って骨子生成(PREP構成 + FAQ項目を含む)
③ /prompts/draft-prompt.md + /prompts/persona.md を使って下書き生成
   - EXPERIENCEが必要な箇所は /data/experience-notes.md から該当する実話を引用する
   - 見つからない場合はプレースホルダーのまま残す
④ /prompts/note-rewrite-prompt.md を使ってnote版をリライト生成(QCEP構成)
   - 完全コピペ禁止、視点を変えて再構成する
⑤ /prompts/factcheck-prompt.md を使って数値・固有名詞のファクトチェックを実行
   - 特にdoda/ワークポートの評価コメントが experience-notes.md の内容と一致しているか確認
⑥ /data/articles-status.json のステータスを更新
⑦ 完了した記事のサマリ(タイトル、ステータス、残タスク)を人間に報告する
```

---

## 特に厳守すること

- **cta_agents(比較記事で紹介するエージェント)は doda・ワークポートを主軸にする**。第二新卒エージェントneo・ハタラクティブは「著者の利用経験なし」として明確に区別し、体験談パートに混ぜない
- **doda経由で内定・入社した事実を変更しない**。ワークポートは「紹介はあったが内定には至らなかった」という事実を正確に保つ
- 著者の権威性(人材紹介・派遣会社のSEO/AIO担当)は、採用担当としての実務経験があるかのように誇張しない
- **記事本文を編集したら、その記事の `dateModified` を編集日(JST)に必ず更新する**。`dateModified` は JSON-LD(Article.dateModified)・OGP の modifiedTime・sitemap の lastModified・記事の「更新日」表示に使われるため、外部参照の追加・太字ルールの適用・文言修正など**内容に手を入れたら毎回更新する**(`datePublished` は不変)。手作業に頼らず `node scripts/update-modified.js --changed`(gitで変更中の記事を自動検出して当日日付に更新)を使うとよい。誤字修正のみなど軽微な変更で更新しない判断をする場合は、その旨を人間に報告する

---

## 人間への報告フォーマット

各記事の作業完了時、以下の形式で報告すること。

```
記事: {タイトル}
ステータス: {現在のステータス}
埋まったEXPERIENCE: {箇所数} / {必要箇所数}
未解決のプレースホルダー: {あれば具体的に列挙}
note版: {作成済み / 未作成}
次のアクション: {人間が確認・追加すべきこと}
```
