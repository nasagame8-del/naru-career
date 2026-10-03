# Next Instruction

- instructionId: `WAR-EV0C6DBEHFLN`
- issuedBy: `NARU ChatGPT / Slack War Room`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `SLACK_LIVE_WAR_ROOM`

## Slack trace

- eventId: `Ev0C6DBEHFLN`
- channel: `C0C71TPTSHW`
- messageTs: `1790989571.712849`

## User request

やあ

## ChatGPT initial position

Claudeへの直接依頼として受け取りました。Claude本人に回答させます。

## Claude assignment

やあ

Shared context from the same Slack thread and referenced Drive material follows. Use it as evidence; do not claim it was unavailable.
## Slack thread context
[prior][user:U0C6AR38QBW] 【SEO・AIO】
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> <@U0C66M6ASLW> <@B0C73253VQ8> ここはNARUのSEO.AIOについて議論するスレッド。気になる情報とか、これこうした方がいいのでは？みたいなのは俺が持ってくるから活発に議論して欲しい
[prior][bot] 受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。
[prior][bot] 了解。持ち込んでもらった情報や案に対して、SEO・AIOの観点からメリットや懸念、より良い代案まで率直に議論します。
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> `Drive見ながらClaudeとこの企画について議論して。企画はChatGPT、反論はClaude。必要なら実装までして` `ウェブサイトが公開された直後にやるべき10のこと 👇 1.) Google Search Consoleを設定する` • `Googleがあなたのサイトをどのように見つけているかを正確に把握する` `2.) サイトマップを送信する` • `数週間ではなく数日でインデックスされる` `3.) Bing Webmaster Toolsに追加する` • `Bingは他のツール（一部のAIアシスタントを含む）の検索結果も提供している` `4.) robots.txtを確認する` • `1行のミスでサイト全体がGoogleから隠れてしまう可能性がある` `5.) Google Analyticsを設定する` • `すべての訪問者がどこから来ているかを知る` `6.) Google Business Profileを作成する` • `地図やローカル検索に表示される` `7.) 各ページに独自のタイトル + 説明文を設定する` • `それが検索結果で人々がクリックする部分だ` `8.) Open Graph画像を追加する` • `X、WhatsApp、LinkedInで共有されたリンクが良く見える` `9.) モバイルですべてをテストする` • `訪問者のほとんどがスマホを使っている` `10.) PageSpeed Insightsで速度を確認する` • `遅いサイトは訪問者とランキングを失う` `11.) カスタム404ページを設定する` • `壊れたリンクで顧客を失わないように` `12.) 関連するレビューサイトとディレクトリに登録する` • `初日からバックリンク + 信頼を得る` `すべて無料。1午後で終わる。`
[prior][bot] 受信しました。スレッドと参照資料を確認し、必要ならClaudeへ自動で回します。
[prior][bot] 企画としては、公開直後のチェックリストをNARU向けに整える価値があります。ただし原文は「10」と言いながら12項目あり、「数日でインデックス」「すべて無料・1午後」も保証できません。Google Business Profileやディレクトリ登録は事業形態・地域性に応じて判断し、計測タグや外部登録はプライバシー・運用面も確認すべきです。Drive資料はこのスレッドには添付されていないため、まずNARUの公開状況・既存のSEO/AIO方針と照合し、実装が必要なら安全な範囲に限るのがよいです。 Claudeにも反論・検証させたうえで実装を開始しました。 Draft PR: <https://github.com/nasagame8-del/naru-career/pull/88> 本番マージ・公開は自動では行いません。
[current][user:U0C6AR38QBW] <@U0C66M6ASLW> やあ
[prior][bot] 受信しました。スレッドと参照資料を確認し、必要ならClaudeへ自動で回します。

Finish with a concise Japanese section headed exactly '## Slack reply' in REPORT.md so the War Room can display your actual response.

Before implementing, explicitly challenge ChatGPT's initial position:
1. state what is correct,
2. state what is risky or wrong,
3. propose the safest implementation approach.

Then make only safe, scoped changes needed for this request, run relevant tests, update `docs/agent-handoff/REPORT.md`, and stop.

## Hard boundaries

- Do not edit `STATE.json` or `NEXT_INSTRUCTION.md`.
- Do not push directly to master/main.
- Do not merge any PR.
- Do not deploy production.
- Do not expose or request secret values.
- Do not add or call paid external APIs.
- Preserve existing NARU article/publication/preview approval gates.
- If a destructive, credential, irreversible, or ambiguous decision is required, stop with REPORT status `NEEDS_DECISION`.
- Maximum workflow budget remains 8 Claude turns and 15 minutes.
