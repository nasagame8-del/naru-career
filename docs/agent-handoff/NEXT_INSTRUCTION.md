# Next Instruction

- instructionId: `WAR-EV0C69Q2BL93`
- issuedBy: `NARU ChatGPT / Slack War Room`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `SLACK_LIVE_WAR_ROOM`

## Slack trace

- eventId: `Ev0C69Q2BL93`
- channel: `C0C71TPTSHW`
- messageTs: `1790989624.797079`

## User request

`Drive見ながらClaudeとこの企画について議論して。企画はChatGPT、反論はClaude。必要なら実装までして`

## ChatGPT initial position

企画案：Driveの資料をもとに、読者に役立つ具体的な学びや事例を一つに絞ったnote記事を企画します。現時点ではこのスレッドにDrive資料の内容が渡っていないため、資料を確認でき次第、企画を具体化します。記事制作は企画への反論を踏まえてから判断し、実装や公開は行いません。

## Claude assignment

Driveフォルダ（https://drive.google.com/drive/folders/1w09HYtWpkO38wF89HX29i6YVcl2AEHmE）とSlackのDriveアプリで閲覧可能な資料を確認してください。アクセスできる場合は、資料に基づいてnote企画案を評価し、ChatGPTの方針（読者に役立つ具体的な学び・事例を一つに絞る）に対して、根拠付きで反論・改善案を提示してください。企画の目的、想定読者、資料の根拠、記事の切り口と構成案をまとめ、資料間の不一致や不足も明記してください。確認後、安全で必要な範囲なら記事の草稿まで作成して構いませんが、公開・本番デプロイ・mergeはしないでください。資料にアクセスできない場合は推測で補わず、必要な共有権限または資料本文の提示を求めてください。外部有料APIは新規利用しないでください。

Shared context from the same Slack thread and referenced Drive material follows. Use it as evidence; do not claim it was unavailable.
## Slack thread context
[prior][user:U0C6AR38QBW] 【note】
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> <@U0C66M6ASLW> <@B0C73253VQ8> ここはnoteの記事を作る場所。 <https://drive.google.com/drive/folders/1w09HYtWpkO38wF89HX29i6YVcl2AEHmE|https://drive.google.com/drive/folders/1w09HYtWpkO38wF89HX29i6YVcl2AEHmE> ここの情報持ってきてこういう記事書いた方がいいんじゃみたいなのを議論して、Claudeにつくってもらう。企画立案はチャッピーがやって
[prior][bot] 受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。
[prior][bot] 了解です。ここでは私がnote記事の企画を立て、共有いただいた情報をもとに「どんな記事がよさそうか」を議論します。記事の制作をClaudeに頼む段階では、狙い・構成・参照資料をまとめて依頼します。まず、Drive内の資料をこちらから直接確認できないため、候補資料の本文や概要を貼るか、アクセス可能な形で共有してください。
[prior][user:U0C6AR38QBW] あなたの親元のアカウントは見れるからそっちから共有してもらったら？
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> あなたの親元のアカウントは見れるからそっちから共有してもらったら？
[prior][bot] 受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。
[prior][bot] 親元のアカウントや共有権限にはアクセスできないよ。見せたい内容をここに貼るか、共有可能なリンクを送ってね。
[prior][user:U0C6AR38QBW] いまSlackにドライブアプリいれたからみれるんじゃない
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> <https://naru-mk93466.slack.com/archives/C0C71TPTSHW/p1790990534268449?thread_ts=1790989624.797079&amp;channel=C0C71TPTSHW&amp;message_ts=1790990534.268449>
[prior][bot] 受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。
[prior][bot] リンク先のSlack投稿は確認できません。本文を貼ってください。
[prior][user:U0C6AR38QBW] <@U0C66MEQJ06> いまSlackにドライブアプリいれたからみれるんじゃない
[prior][bot] 受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。
[prior][bot] この会話からSlackのドライブアプリやファイルは直接見られないよ。内容をここに貼るか、見られる状態で共有してくれれば確認できる。
[current][user:U0C6AR38QBW] <@U0C66MEQJ06> `Drive見ながらClaudeとこの企画について議論して。企画はChatGPT、反論はClaude。必要なら実装までして`
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
