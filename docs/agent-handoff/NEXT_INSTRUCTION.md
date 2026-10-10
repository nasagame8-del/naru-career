# Next Instruction

- instructionId: `NONE`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `IDLE`
- mode: `CLOUD_CLAUDE_BRIDGE`

## Current state

No Claude task is active on master.

To start a task, ChatGPT must first create or reuse a dedicated task branch and Draft PR, then update that branch's `STATE.json` to `status: RUN_CLAUDE` with a new unique `instructionId`.

After writing a concrete instruction here, ChatGPT triggers the cloud worker by commenting on that PR:

```
@naru-autopilot <instructionId>
```

Claude must execute only that instruction, update `REPORT.md`, and stop. ChatGPT reviews the resulting diff and tests before deciding whether a second instruction is needed.

## Default limits

- `maxClaudeTurns`: 8
- workflow hard cap: 8
- autonomous review/implementation rounds: 2
- no recursive self-trigger
- no direct push to master
- no production merge/deploy without the normal NARU gates and required approval

## UI decoration review — USER-UI-DECORATION-20261005

User requested implementation using the Xserver readability article as reference. Authorized: dedicated `ui/article-decoration-refresh` branch, Draft PR, isolated Cloudflare preview. No master push, merge or production deploy. No Claude task is requested.


## USER-ARTICLE69-DATE-20261010
ユーザーの「それ直して」に基づき、記事69のdatePublished/dateModifiedを実公開日2026-10-09へ修正する。専用PR作成、同head CI確認、squash mergeとCloudflare本番検証を許可。本文・画像・他PRは変更しない。Claudeタスクは起動しない。

## USER-SHINDAN-RPG-PUBLISH-20261010
ユーザーが「公開していいよ細かい修正はこっちでする」と明示承認。PR #180のReady化、masterへのPR経由マージ、Cloudflare本番デプロイ、実際の /shindan の確認を許可。追加のUI修正・他PRのマージは行わない。master直接pushなし。Claudeタスクは起動しない。
