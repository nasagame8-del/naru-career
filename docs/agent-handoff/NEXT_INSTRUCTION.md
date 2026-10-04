# Next Instruction

- instructionId: `NARU-EDITOR-V1-002A`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- branch: `agent/naru-editor-agent-v1`

## Scope

The previous round-2 attempt hit the 8-turn cap before commit. Do only **manifest + pure reconciler** now. Do not implement CLI, workflows, adapters, or full build in this run.

Read AGENTS.md and `src/lib/naru-editor-agent/*` first. Preserve the completed round-1 state evaluator.

## Implement

Under `src/lib/naru-editor-agent/` add a versioned daily manifest model and a pure evidence reconciler.

### Manifest

Repository path convention (document only in core; no filesystem I/O required here):
`data/editor-agent/run-YYYY-MM-DD.json`

Manifest must include:
- `schemaVersion: 1`
- `date: YYYY-MM-DD`
- `candidatesReady`
- run blockers
- two slots `1` and `2` using the existing `ArticleSlotFacts`
- `lastReconciledAt` optional
- evaluation is derived, not authoritative

Add helpers:
- create empty manifest for a date
- validate/normalize a parsed manifest
- serialize deterministically to JSON string
- convert manifest -> existing `EditorRunFacts`

Unknown optional fields may be ignored safely; critical malformed fields must throw a clear error. Never invent identities.

### Evidence

Define a partial `EditorRunEvidence` shape suitable for ChatGPT/connectors. It can update run-level facts and either article slot.

Implement `reconcileRunManifest(existing, evidence)` with these rules:
- update only explicitly supplied fields
- omission never erases known facts
- same evidence twice is semantically idempotent
- candidateId / articleId / slug identity conflicts fail closed with an error; do not silently replace
- selection must remain explicit (`selected: true`)
- slot 1 and 2 merge independently
- image refs card/01/02/03 merge independently
- new latestHeadSha may be stored, but stale QA/CI/preview approval must not become valid (existing evaluator already SHA-binds them)
- blockers are preserved by omission
- support explicit blocker replacement via a clearly named field such as `replaceBlockers`; do not make ordinary omission clear blockers
- no network/filesystem I/O

### Tests

Add focused Vitest tests covering:
1. empty manifest
2. validation/serialization round trip
3. partial evidence preserves known data
4. identity conflict rejects
5. image refs merge independently
6. head change leaves stale gates ineffective under evaluator
7. blocker omission preserves
8. explicit blocker replacement clears/resolves
9. two slots independent
10. repeated reconciliation idempotent
11. malformed date/schema rejected
12. legacy/absent optional fields normalize safely

Run only:
- `npx vitest run src/lib/naru-editor-agent`
- `npx tsc --noEmit`

Update `docs/naru-editor-agent-v1.md` only enough to document schemaVersion/path and that CLI is still pending.

Update REPORT.md with exact results and Japanese `## Slack reply`.

## Hard limits

- no CLI/script/package.json yet
- no .github/workflows
- no article edits
- no network calls
- no paid APIs
- no master push/merge/deploy
- <= 8 changed files

Finish and commit within this run; do not expand scope.