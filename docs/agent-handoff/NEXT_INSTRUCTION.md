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
- workflow hard cap: 12
- autonomous review/implementation rounds: 2
- no recursive self-trigger
- no direct push to master
- no production merge/deploy without the normal NARU gates and required approval
