# ChatGPT ↔ Claude Code Autopilot

このディレクトリは、NARU開発で人間がChatGPTとClaude Codeの間をコピペしないための自動オーケストレーション用です。

## Control plane

- coordination branch: `agent/autopilot`
- ChatGPT owns: `STATE.json`, `NEXT_INSTRUCTION.md`
- Claude Code owns: `REPORT.md`
- GitHub Actions executes Claude automatically when `NEXT_INSTRUCTION.md` changes and `STATE.json.status=RUN_CLAUDE`
- ChatGPT automation periodically checks for a new Claude report and, when safe, writes the next instruction automatically

## State machine

```
WAITING_FOR_SEED
  ↓
RUN_CLAUDE
  ↓
WAITING_FOR_CHATGPT
  ↓
RUN_CLAUDE
  ↓
...
  ├─ PR_READY
  ├─ HUMAN_REQUIRED
  └─ FAILED
```

## Single-writer rule

- `NEXT_INSTRUCTION.md`: ChatGPT only
- `STATE.json`: ChatGPT only
- `REPORT.md`: Claude Code only
- implementation/test files: Claude Code while an instruction is active

Do not violate these ownership rules. They prevent recursive commits and state corruption.

## Claude execution

Workflow: `.github/workflows/naru-agent-autopilot.yml`

Trigger:
- push to `agent/autopilot`
- only when `docs/agent-handoff/NEXT_INSTRUCTION.md` changes
- workflow additionally checks that `STATE.json.status == RUN_CLAUDE`

Authentication:
- GitHub repository secret `CLAUDE_CODE_OAUTH_TOKEN`
- preferred because Claude Pro/Max users can generate it with `claude setup-token`
- do not store the token in repository files

Claude must:
1. Read AGENTS.md, STATE.json, NEXT_INSTRUCTION.md, REPORT.md.
2. Refuse duplicate instructionIds.
3. Execute only the active instruction.
4. Update REPORT.md before finishing.
5. Leave changes in the working tree; the workflow commits/pushes them to `agent/autopilot`.

## ChatGPT review loop

When a new REPORT.md appears:
1. Read REPORT.md + STATE.json + relevant git diff/code.
2. If the result is safe and more work is needed, determine the next concrete instruction.
3. Increment instructionId and iteration.
4. Update STATE.json first with status `RUN_CLAUDE`.
5. Update NEXT_INSTRUCTION.md last. That final write triggers Claude exactly once.
6. Never ask the human to copy/paste the report.

If no new report exists, do nothing.

## Automatic stop conditions

Stop and surface to the human when any of these occurs:
- status `PR_READY`
- iteration reaches maxIterations
- same blocker repeats twice
- production deploy or merge would be required
- secret/credential input is required
- destructive migration/deletion needs business approval
- irreversible content/business decision lacks evidence

Normal test failures, lint failures, regressions, timeout fixes, QA fixes, and code-level decisions should be handled automatically when evidence is sufficient.

## Current seed requirement

The current local SEO Editor implementation and latest E2E fixes are not yet present on the remote `agent/autopilot` branch. Before the loop can safely start, that local branch must be pushed once and incorporated into `agent/autopilot`.

After that one-time seed, the ChatGPT ↔ Claude loop is designed to run without manual copy/paste.

## Safety

- no direct push to master/main
- no automatic merge to master
- no automatic production deploy
- no secrets in REPORT.md
- no bypass of SEO Editor signature/QA/publish gates
- maximum autonomous iterations: 8
