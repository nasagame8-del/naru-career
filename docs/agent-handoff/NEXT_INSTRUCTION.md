# Next Instruction

- instructionId: `SMOKE-20261002-002`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `CLOUD_CLAUDE_BRIDGE_SMOKE`

## Goal

Verify that the cloud ChatGPT → GitHub Actions → Claude Code bridge works after the workflow fix.

## Required actions

1. Read `AGENTS.md`, this instruction, `STATE.json`, and the current `REPORT.md`.
2. Do not change application code, article content, workflow files, STATE.json, or this file.
3. Do not call OpenAI APIs, Anthropic API-key billing, or any external paid API.
4. Do not browse the web or install packages.
5. Run only:
   - `git status --short`
   - `git rev-parse --abbrev-ref HEAD`
6. Replace `docs/agent-handoff/REPORT.md` with a concise report containing:
   - reportId: `REPORT-SMOKE-20261002-002`
   - completedInstructionId: `SMOKE-20261002-002`
   - status: `DONE`
   - branch
   - summary that the OAuth-authenticated Claude Code worker executed in GitHub Actions
   - the two command results
   - changed files: only `docs/agent-handoff/REPORT.md`
   - decisions needed: none
   - recommended next step: ChatGPT verifies the workflow run and closes the smoke-test PR without merging.

## Boundaries

- Smoke test only.
- No implementation changes.
- No test suite or build.
- No PR merge.
- No production deploy.
- Finish immediately after writing REPORT.md.
