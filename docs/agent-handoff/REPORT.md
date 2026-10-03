# Claude Code Report

- reportId: `REPORT-WAR-EV0C6H1XL725`
- completedInstructionId: `WAR-EV0C6H1XL725`
- status: `DONE`
- branch: `war-room/ev0c6h1xl725`

## summary

### ChatGPT案への検証
1. 正しい点: 公開直後チェックリストをNARU向けに整える価値がある。項目数の不整合（10と言いつつ12項目）、「数日でインデックス」「すべて無料・1午後」が保証できない、GBP・ディレクトリは事業形態次第、計測は同意/プライバシー確認が要る、という指摘はいずれも妥当。
2. 危うい点: (a) Drive資料は入力になく、repoとの照合が前提。(b) 原文の多くはNARUで実装済みで、新規実装を足すと重複・過剰になる。(c) 「BingがAIアシスタントの検索結果も提供」は一部ツールで過去にそうだった程度で、現状は一般化できない。(d) GBPは実店舗/来店型でないNARU（オンラインメディア）は対象外の公算が高い。
3. 安全な進め方: 実装済みを棚卸しし、コード側に足りない所有権確認だけを環境変数駆動（値未設定なら何も出力しない）で追加。外部登録・タグ追加・同意UIは人間判断として切り出す。

### repo照合（実装済み）
- robots.ts: 非公開パス（/internal /members /api）をdisallow、sitemap指定あり、CCBotのみ全ブロック
- sitemap.ts / IndexNow（api/indexnow、public/ の鍵ファイル）
- GTM（NEXT_PUBLIC_GTM_ID）、Microsoft Clarity
- metadataBase・title template・OG（ロゴ画像）・favicon、not-found.tsx
- 診断結果ページ noindex、/types/* index（REPORT-010）

### 今回の変更
- `src/app/layout.tsx`: `verification` を追加。`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION` が設定された時だけ meta を出力（Search Console / Bing Webmaster Tools の所有権確認用。トークンは公開前提の値でsecretではない）。

### NARU向け優先順位付きチェックリスト
1. Search Console登録＋sitemap送信（環境変数にトークン設定→人間が実施）
2. Bing Webmaster Tools登録（Search Consoleからのインポート可。IndexNow実装済み）
3. robots.txt/sitemap本番確認（実装済み、本番URLで目視のみ）
4. 計測: GA4はGTM経由。GA4とClarityの同意取得UI有無はプライバシー判断が必要（privacyページには記載あり、同意バナーは未確認/なし）
5. ページ別title/description・OG: 記事・types等は個別設定。OGは全体でロゴ固定のため、記事別OG画像は将来課題（効果は共有時の見栄え）
6. モバイル/PageSpeed: 実測は本番URLで人間が実施（このrunnerでは不可）
7. 404: 実装済み
8. GBP・ディレクトリ登録: 低優先。GBPは実店舗/対面サービスがなければ不適格の可能性大。ディレクトリのバックリンクは質が低いと逆効果のため厳選

## tests and timings
- `tsc --noEmit` / `eslint`: このrunnerは node_modules 未導入（@types/node, vitest 不在）のため実行不可。変更は Next.js 標準の `Metadata.verification`（google / other）のみの小変更。
- 実測テストなし。

## changed files
- src/app/layout.tsx
- docs/agent-handoff/REPORT.md

## git diff summary
layout.tsx に verification ブロック +7行。

## existing issues found
- 同意バナー（Cookie同意）が見当たらない。GA4/Clarity利用はprivacyに記載のみ。
- OG画像が全ページ共通のロゴ。

## remaining risks
- 型検証が未実施（Next.js版がAGENTS.mdの通り差異ある可能性。`verification.other` の型は要CIで確認）。
- Drive資料は参照できていない。

## decisions needed
- 同意バナー導入の要否（法務/方針判断）
- GBP/ディレクトリ登録の可否
- Search Console/Bing のトークン発行と環境変数設定（人間）

## recommended next step
CIでtype/lint確認 → Vercelに環境変数設定 → Search Console/Bing登録とsitemap送信。

## Slack reply
検証結果です。ChatGPT案の「項目数の不整合」「数日でインデックス・無料・1午後は保証不可」「同意/プライバシー確認が必要」は妥当。ただしDrive資料は入力になく、またrepo照合の結果、robots/sitemap/IndexNow/GTM/Clarity/OG/404は実装済みで、新規実装は不要でした。GBPは実店舗がなければ不適格の可能性が高く、ディレクトリ登録は質を厳選すべきです。「BingがAI検索を支える」も一般化は危険。実装は、Search Console/Bing所有権確認metaを環境変数設定時のみ出力する小変更（layout.tsx）に限定。runnerにnode_modulesが無くtsc/lintは未実行のためCIで確認を。人間判断: 同意バナー要否、トークン発行と環境変数設定、GBP/ディレクトリ可否。優先順は、SC登録+sitemap送信→Bing→計測同意→実測(PageSpeed/モバイル)。
