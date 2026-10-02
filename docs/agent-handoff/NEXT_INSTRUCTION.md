# Next Instruction

- instructionId: `SMOKE-20261002-003`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `CLOUD_CLAUDE_BRIDGE_SMOKE`

## Goal

Complete the smallest possible cloud-worker smoke test.

## Required action

After the standard files from the workflow prompt are read, replace only `docs/agent-handoff/REPORT.md` with a concise report:

- reportId: `REPORT-SMOKE-20261002-003`
- completedInstructionId: `SMOKE-20261002-003`
- status: `DONE`
- branch: `test/claude-cloud-smoke-20261002-v3`
- summary: cloud Claude worker reached the active instruction and updated the handoff report
- tests: none; smoke test only
- changed files: only `docs/agent-handoff/REPORT.md`
- existing issues found: none
- remaining risks: none for this smoke test
- decisions needed: none
- recommended next step: ChatGPT verifies the Actions run and closes this PR without merging

## Boundaries

- Do not modify any other file.
- Do not run tests, builds, web browsing, package installation, or external API calls.
- Do not merge or deploy.
- Finish immediately after writing REPORT.md.
