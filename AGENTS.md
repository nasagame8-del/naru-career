<!-- BEGIN:naru-production-infra -->
# NARU production infrastructure source of truth

2026-10-04以降、NARUの本番ホスティングは **Cloudflare Workers** が正本です。Vercelは本番判定・公開ゲート・プレビュー成功条件として使用しません。

- Production: `https://naru-career.com`
- Worker: `naru-career` / Broad Fuchsia
- Deploy source of truth: GitHub Actions `Deploy NARU to Cloudflare` on `master`
- `www.naru-career.com` はCloudflare Worker経由でapexへ308 redirect
- DNS authoritative nameservers: Cloudflare
- GSC/GA4 runtime auth: Cloudflare上のOAuth設定
- Contact: Cloudflare runtime + Resend。実送信・delivered確認済み
- IndexNow: アプリ側経路は正常。外部IndexNowの429 TooManyRequestsは公開ブロッカーにしない
- Vercelの自動ビルドは停止済み。Vercelのdeployment/statusが古い・失敗・未生成でも、それをNARU本番の失敗根拠にしない
- `Vercel Production`, `Vercel Preview`, `Vercel commit status`, `Vercel Cron` を新規の成功条件に追加しない
- 公開後の最終確認は、対象merge SHAのCloudflare deploy成功と `https://naru-career.com/articles/<slug>` の実レスポンス/表示で行う

古い手順・タスク・ドキュメントにVercel前提が残っている場合は、この節を優先してCloudflare前提へ読み替えてください。
<!-- END:naru-production-infra -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:naru-agent-handoff -->
# NARU ChatGPT ↔ Claude Code handoff

このリポジトリでは、ChatGPTとClaude Codeの受け渡しを `docs/agent-handoff/` で行います。

## 作業開始時

通常の開発指示を受けた場合でも、最初に以下を確認してください。

1. `docs/agent-handoff/NEXT_INSTRUCTION.md`
2. `docs/agent-handoff/REPORT.md`
3. 必要なら `docs/agent-handoff/README.md`

`NEXT_INSTRUCTION.md` にACTIVEなinstructionIdがあり、`REPORT.md` のcompletedInstructionIdと一致していない場合、その指示を現在の正式な作業指示として扱ってください。

## 作業終了時

作業結果は人間に長文コピペさせる前提にせず、必ず `docs/agent-handoff/REPORT.md` を更新してください。

REPORTには最低限以下を含めます。

- reportId
- completedInstructionId
- status
- branch
- 実施内容
- テスト結果
- 変更ファイル
- git diff概要
- 既知の問題
- 判断が必要な項目
- 推奨する次の作業

## Ownership

- `NEXT_INSTRUCTION.md`: ChatGPTが管理。Claude Codeは変更しない。
- `STATE.json`: ChatGPTが管理。Claude Codeは変更しない。
- `REPORT.md`: Claude Codeが管理。
- `HISTORY/`: 必要な節目のみ保存。

## Safety

- 同じinstructionIdを二重実行しない。
- 判断が必要なら推測で進めず `NEEDS_DECISION` としてREPORTに残して停止する。
- secrets/tokenをREPORTに書かない。
- master/mainへの直接push、PR作成、merge、production deployはNEXT_INSTRUCTIONに明示された場合のみ行う。
- SEO Editorの署名、QA、publish block、GitHub安全策を迂回しない。
<!-- END:naru-agent-handoff -->
