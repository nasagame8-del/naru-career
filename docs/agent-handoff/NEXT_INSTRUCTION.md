# Next Instruction

- instructionId: `INST-002`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`

## Goal

Validate the fully integrated `agent/autopilot` branch now that the E2E-validated `feat/seo-editor` seed has been merged. Fix only concrete regressions or integration issues. If the branch is safe for human review, finish with `status: PR_READY` in `REPORT.md`.

## Facts already established

- `feat/seo-editor` was pushed and merged into `agent/autopilot` as PR #8.
- `master` was normalized to the former `work` head and is the intended final base branch.
- `CLAUDE_CODE_OAUTH_TOKEN` is configured as a GitHub Actions repository secret.
- Vercel Production has `SEO_EDITOR_RUN_SECRET` and `SEO_EDITOR_BASE_BRANCH=master`.
- Previous E2E completed Phase 1–9 with no timeout and no QA FAIL.
- `/diagnosis` → `/shindan` was fixed in 15 article Markdown files.
- Do not assume the local developer machine is available. Work only from the repository checkout and CI-accessible resources.

## Do

1. Read `AGENTS.md`, handoff files, and the current git diff against `master`.
2. Confirm the seeded SEO Editor files are present, including `src/lib/seo-editor/run.ts`, Phase 1–9, publish route, UI, and `vercel.json`.
3. Run the relevant non-destructive validation available in CI:
   - install dependencies using the repository's lockfile
   - lint
   - build
   - focused unit/fixture checks for QA-origin gating, frontmatter preservation, publish blocking, and broken-link behavior if those test entry points exist
4. Check that no credentials or tokens were committed.
5. Check that `agent/autopilot` is based on the expected normalized `master` history plus the seed/autopilot changes only.
6. Fix only issues proven by the above checks. Do not perform broad refactors.
7. Verify `/diagnosis` is absent from article Markdown links and `/agent-diagnosis` remains untouched.
8. Verify `maxDuration=180` and `vercel.json` explicitly enables Fluid Compute.
9. Verify the autonomous workflow itself is syntactically valid and does not write to `master`.
10. Update `REPORT.md` with exact results.

## Do not

- push directly to `master`
- merge into `master`
- deploy production
- create or rotate secrets
- change business/content decisions without evidence
- remove or bypass SEO Editor signature/QA/publish gates
- rewrite validated article content except for a concrete defect discovered by validation

## Completion rule

If all blocking checks pass and only known non-blocking warnings remain, set:

- `status: PR_READY`

The GitHub workflow will then open a draft PR from `agent/autopilot` to `master` automatically.

If a real blocker remains that can be fixed safely, fix it and report the result.
If a blocker requires a secret, destructive operation, production action, or product/business decision, set `NEEDS_DECISION` and stop.
