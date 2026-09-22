# Next Instruction

- instructionId: `INST-004`
- issuedBy: `ChatGPT Work`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `NEW_ARTICLE_AUTOPILOT_PRODUCTION_GAPS`

## Goal

Finish the remaining production-critical gaps found during independent review of commit `874bab1`.

INST-003 built a sound and tested foundation, but the original success condition is still not met because:

1. `runResearch()` does not perform live web research; it asks an LLM without search and only validates URL syntax.
2. `stepQa()` always passes `buildPassed: null`, so every run gets NEEDS_REVIEW.
3. Therefore automatic publication can never occur.
4. Candidate storage defaults to non-durable memory unless an env var is set.

Close these gaps without weakening any existing safety gate.

## Required changes

### A. Real, attributable research

Implement actual live web research for article claims.

- Prefer the installed OpenAI SDK's current Responses API web search tool.
- Verify the exact SDK API from installed typings/docs before coding; do not rely on stale memory.
- Search for current/authoritative sources relevant to the selected topic.
- Prefer Japanese government, official product/company documentation, standards bodies, and primary sources.
- Persist for every source: title, canonical URL, retrieved date, and supported claims.
- A syntactically valid URL is not sufficient evidence.
- Never invent URLs or citations.
- If web search is unavailable, errors, or yields no support for a time-sensitive claim, preserve it as unsupported and block publication.
- Add tests around normalization, source/claim mapping, duplicate URLs, invalid URLs, and no-result behavior.
- Keep user-authored/personal experience restrictions unchanged.

### B. Durable candidate storage must be safe by default

- In production, use the existing GitHub candidate store by default.
- Memory storage may be used only for test/development or when explicitly selected outside production.
- If production lacks the required GitHub configuration/token, fail closed with a clear API/UI error; do not silently fall back to memory.
- Keep `durable` reporting and tests.
- Do not add a paid database or new integration.

### C. Real validation gate for generated article PRs

Add a dedicated GitHub Actions validation workflow for Article Factory PRs.

- Trigger on pull requests that change:
  - `content/articles/**`
  - `data/article-runs/**`
- Run:
  - `npm ci`
  - `npm test`
  - `npx tsc --noEmit`
  - `npm run build`
- Give the job a stable, explicit name such as `article-factory-validation`.
- Read-only permissions are sufficient.
- Do not expose secrets.
- Allow this instruction to add `.github/workflows/article-factory-validation.yml`.

Update the durable Article Factory workflow so that after creating the article PR it:

1. obtains the PR head SHA,
2. waits durably and polls GitHub check-runs/statuses,
3. requires the Article Factory validation check and Vercel Preview check to succeed,
4. treats pending as pending (sleep/retry, not pass),
5. blocks on failure/cancel/timeout/missing required checks,
6. only then produces a QA result with `buildPassed: true` and reevaluates `canAutoPublish()`.

Do not merge based only on a locally supplied boolean.

Use Workflow DevKit correctly:
- orchestration and `sleep()` in the `"use workflow"` function,
- GitHub API polling in `"use step"`,
- serializable values only.

### D. Safe automatic publication and production confirmation

- Keep `ARTICLE_FACTORY_AUTO_PUBLISH` as the explicit server-side authorization flag.
- With the flag off, leave the validated PR open.
- With the flag on, merge only after all QA and required checks pass.
- Make the merge function return the merge commit SHA.
- After merge, wait for the production deployment status associated with that merge commit.
- Report `published: true` and a production URL only after production deployment success.
- On deployment failure/timeout, report a blocked/error state; never claim publication completed.
- Preserve idempotency for workflow replay and repeated polling.

### E. UI/status

Expose these states clearly:
- web research
- PR validation pending/passed/failed
- merge pending/completed
- production deployment pending/succeeded/failed
- exact blocking reason

A browser reload must continue to reconstruct progress from the Workflow stream.

## Tests

Add focused tests for:

- research normalization and unsupported-claim fallback
- production storage cannot silently use memory
- required check pending/success/failure/missing/timeout decisions
- merge is impossible before checks pass
- production URL is not returned before deployment success
- idempotent replay after PR already exists or is already merged

Run and report:

- `npm ci`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- lint for all new/changed files
- workflow YAML syntax validation if available
- verify built Workflow endpoints and Article Factory routes

## Boundaries

- Work on `agent/new-article-autopilot`.
- Do not edit existing article content.
- Do not generate a real article.
- Do not merge PR #15 or push to master.
- Do not deploy production.
- Do not weaken SEO Editor or Article Factory safety checks.
- Do not commit credentials.
- Do not edit `STATE.json` or `NEXT_INSTRUCTION.md`.
- Update `REPORT.md` to REPORT-004.

## Completion

Use `PR_READY` only if real research, durable production storage behavior, external CI/build gating, and post-merge production confirmation are implemented and all requested tests pass.

Otherwise use `NEEDS_DECISION`, `BLOCKED`, or `FAILED` with the exact blocker.
