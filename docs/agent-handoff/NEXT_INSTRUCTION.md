# Next Instruction

- instructionId: `WAR-EV0C6K3VNZ7E`
- issuedBy: `NARU ChatGPT / Slack War Room`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `SLACK_LIVE_WAR_ROOM`

## Slack trace

- eventId: `Ev0C6K3VNZ7E`
- channel: `C0C71TPTSHW`
- messageTs: `1790989631.287239`

## User request

やぁ

## ChatGPT initial position

Claudeへの直接依頼として受け取りました。Claude本人に回答させます。

## Claude assignment

やぁ

Shared context from the same Slack thread and referenced Drive material follows. Use it as evidence; do not claim it was unavailable.
## Slack thread context
[prior][user:U0C6AR38QBW] 【なんでも】
[prior][user:U0C6AR38QBW] <@U0C66M6ASLW> やぁ
[current][user:U0C6AR38QBW] <@U0C66M6ASLW> やぁ
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
