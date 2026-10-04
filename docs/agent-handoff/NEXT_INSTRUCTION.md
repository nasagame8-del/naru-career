# Next Instruction

- instructionId: `NARU-EDITOR-V1-002`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `CLOUD_CLAUDE_BRIDGE`
- branch: `agent/naru-editor-agent-v1`

## Context

Round 1 (`NARU-EDITOR-V1-001A`) completed successfully. The deterministic core exists under `src/lib/naru-editor-agent/` with 14 passing tests and tsc success.

This is the final bounded implementation round for **NARU Editor Agent v1**. Do not redesign the round-1 state model unless a test demonstrates a concrete safety defect.

Read AGENTS.md and the current round-1 files first. Production source of truth is Cloudflare Workers.

## Goal

Make the state core operational from repository-backed evidence without adding any network side effects.

The result should let ChatGPT/automation:
1. gather current facts from GSC/Web/Drive/GitHub using its connectors,
2. write one normalized evidence JSON,
3. reconcile that evidence into `data/editor-agent/run-YYYY-MM-DD.json`,
4. ask the CLI for current status / next safe action,
5. stop at the three human gates.

The CLI itself must not fetch external data, merge, deploy, publish, or call paid APIs.

## Required work

### 1. Versioned run manifest

Add a versioned repository manifest shape and helpers under the existing editor-agent module.

Path convention:
`data/editor-agent/run-YYYY-MM-DD.json`

Requirements:
- explicit schema/version field
- run date
- two article slots
- preserved identities and facts from round 1
- evaluation snapshot may be stored, but must be recomputable from facts
- unknown optional fields are tolerated where safe
- malformed critical fields fail closed with a useful error
- serialize with stable deterministic ordering/formatting where practical
- do not replace the existing `selected-queue-YYYY-MM-DD.json`; it remains the upstream selection record

### 2. Normalized evidence + reconciler

Define a normalized evidence object that can be produced by ChatGPT/automation. It must support partial updates for:
- candidatesReady
- explicit user selection facts
- article identity / articleId / slug / title
- branch / PR URL / PR number
- current PR head SHA
- Drive article/images/prompt IDs
- four image refs
- image QA result tied to a SHA
- article QA result tied to a SHA
- CI result tied to a SHA
- preview approval SHA
- requested publish time
- merge SHA
- production deploy verification
- public article URL + actual verification
- blockers

Implement `reconcileRunManifest(existing, evidence)` (or equivalent) so that:
- partial evidence updates only supplied fields
- missing evidence never erases known facts
- explicit null may clear only fields where clearing is safe and documented
- article slot identity cannot silently change from one candidate/slug/articleId to another; conflicting identity must fail closed or add a blocker
- if latestHeadSha changes, stale QA/CI/preview facts must not be treated as current; either preserve them historically but evaluation must invalidate them, or safely clear current-gate fields
- repeated reconciliation with the same evidence is idempotent
- slot 1 and 2 remain independent
- existing blockers are not silently erased unless evidence explicitly resolves them

No external I/O inside the pure reconciler.

### 3. Safe CLI

Add a Node script and package.json command:

`npm run editor-agent -- <command> ...`

Support at minimum:

- `status --date YYYY-MM-DD`
  - read the manifest if present
  - print JSON including run state, both slot states, human gates, reasons

- `next --date YYYY-MM-DD`
  - print concise JSON for the next safe action per slot and any human gate
  - no mutation

- `reconcile --date YYYY-MM-DD --evidence <path.json>`
  - read existing manifest or initialize an empty one
  - parse/validate evidence
  - reconcile
  - write `data/editor-agent/run-YYYY-MM-DD.json`
  - print the resulting evaluation
  - writing the same evidence twice must produce the same semantic manifest

The CLI must:
- never call network APIs
- never invoke GitHub merge/deploy
- never invoke paid API or LLM
- never invent unavailable evidence
- reject invalid date/path inputs cleanly

Prefer ESM and the repository's existing script conventions.

### 4. Tests

Add focused tests for:
- initialize empty manifest
- parse/serialize round trip
- partial evidence preserves existing facts
- identity conflict fails closed
- head SHA change invalidates effective gate/approval
- four image refs merge independently
- explicit blocker add/resolve behavior
- two-slot reconciliation independence
- idempotent reconcile
- CLI status on missing/new manifest
- CLI reconcile -> status/next
- invalid date/evidence rejected

Then run:
- targeted editor-agent tests
- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Do not claim a skipped check passed.

### 5. Documentation

Expand `docs/naru-editor-agent-v1.md` with:
- manifest path and schema version
- evidence ownership:
  - GSC/Web/Drive/GitHub facts are gathered by ChatGPT/connectors
  - Claude Code is an implementation worker, not the source of editorial truth
  - selected queue remains selection source of truth
- CLI examples
- source-of-truth precedence
- quota/cost policy: no paid API fallback, stop on Claude quota/rate-limit rather than buying extra
- future adapter: a scheduler may call the CLI and connectors, but must not bypass human gates

### 6. Finish/report

Update `docs/agent-handoff/REPORT.md` with:
- status
- exact test results
- changed files
- remaining work specifically for the orchestration/scheduler layer

Include a Japanese `## Slack reply` section.

## Hard safety limits

- no `.github/workflows` edits in this Claude round
- no article content edits
- no production merge/deploy
- no direct master push
- no external paid APIs
- no secrets
- no network access needed for feature behavior
- keep changes focused, preferably <= 15 files

## Success condition

Round 2 is DONE only if the branch has a usable repository manifest + idempotent reconciler + safe CLI + tests, and full repository test/typecheck/build results are known.

Do not spend turns on unrelated refactors.