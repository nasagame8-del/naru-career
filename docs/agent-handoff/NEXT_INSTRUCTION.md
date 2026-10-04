# Next Instruction

- instructionId: `NARU-EDITOR-V1-002B`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- branch: `agent/naru-editor-agent-v1`

## Context

Round 1 and Round 2A are DONE. The editor-agent state core and repository manifest/reconciler already exist and have 26 passing targeted tests + tsc success.

This is a very small final implementation pass: **safe local CLI only**. Do not revisit architecture.

Read AGENTS.md and the current `src/lib/naru-editor-agent/*` first.

## Implement

Add a repository CLI command:

`npm run editor-agent -- <command> ...`

Commands:

### `status --date YYYY-MM-DD`

- manifest path: `data/editor-agent/run-YYYY-MM-DD.json`
- if file is missing, evaluate a new empty manifest in memory; do not write it
- output JSON only, with at least:
  - date
  - runState
  - slot 1/2 state
  - nextAction
  - humanGate
  - reasons
- no mutation

### `next --date YYYY-MM-DD`

- no mutation
- output concise JSON with each slot's next safe action and pending human gate(s)

### `reconcile --date YYYY-MM-DD --evidence <file.json>`

- read existing manifest or initialize empty
- parse evidence JSON
- call the existing pure reconciler
- write `data/editor-agent/run-YYYY-MM-DD.json`
- create the directory if needed
- output resulting evaluation as JSON
- same evidence twice must be semantically idempotent

## Runtime choice

Use the smallest maintainable approach compatible with this repo. If running TypeScript directly needs a tiny dev dependency such as `tsx`, adding it is acceptable, but do not add a large framework. Prefer reusing the existing TypeScript core over duplicating evaluator/reconciler logic in a separate JS implementation.

## CLI safety

- validate exact `YYYY-MM-DD`
- reject evidence path missing/unreadable/invalid JSON with nonzero exit
- reject unknown command/flags with nonzero exit
- never call network
- never merge/deploy/publish
- never call LLM or paid API
- never mutate selected-queue
- no secrets
- stdout should be machine-readable JSON; errors may go stderr

## Tests

Add focused tests for CLI behavior, preferably by spawning it in a temp working directory so repository data is not polluted:

1. status on missing manifest
2. next on missing manifest
3. reconcile writes expected manifest
4. reconcile same evidence twice is semantically idempotent
5. status after reconcile reflects gate/state
6. invalid date fails
7. invalid/missing evidence fails
8. unknown command fails

Run only:
- editor-agent targeted tests
- `npx tsc --noEmit`

Do **not** run full npm test/build in Claude; PR CI will do that after commit to save turns.

## Docs/report

Expand `docs/naru-editor-agent-v1.md` with exact CLI examples and source-of-truth notes:
- ChatGPT/connectors gather GSC/Web/Drive/GitHub evidence
- selected-queue remains selection source of truth
- Claude Code is implementation worker
- no paid API fallback; quota/rate-limit means stop/hold

Update REPORT.md with exact targeted test + tsc results and Japanese `## Slack reply`.

## Hard limits

- no workflow edits
- no article edits
- no production action
- no network use by feature
- no paid APIs
- no master push/merge
- keep change focused, <= 8 files

Finish and commit within this run.