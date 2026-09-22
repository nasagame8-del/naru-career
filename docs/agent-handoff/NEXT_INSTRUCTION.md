# Next Instruction

- instructionId: `INST-003`
- issuedBy: `ChatGPT Work`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `NEW_ARTICLE_AUTOPILOT_INFRASTRUCTURE`

## Goal

Complete a production-ready MVP for NARU's **new-article-only autopilot**. This must remain separate from the existing SEO Editor rewrite flow.

The desired user experience is:

1. Every day at 08:00 JST, generate 3–5 genuinely new article candidates.
2. User chooses a candidate with one action.
3. After selection, cloud execution continues even if the browser/PC is closed.
4. The system performs cannibalization checking, research, outline, article writing, frontmatter, internal links, image-plan creation, QA, GitHub PR creation, and safe automatic publication when every gate passes.
5. On any blocking issue, stop safely and expose the reason. Never fabricate first-person experience.

This instruction implements and validates the reusable infrastructure. Do not generate or publish a real new article in this run.

## Authoritative context

- Site: NARU — 第二新卒 × IT/Web転職
- Repository: `nasagame8-del/naru-career`
- Production base branch: `master`
- Existing SEO Editor is for rewrites and must continue to work unchanged.
- Existing env names and GitHub helpers should be reused where safe.
- Existing safety gates (signed state, QA fail block, path allowlist, PR-only writes) must not be weakened.
- Drive content rule:
  - new IDs are max existing NARU article ID + 1
  - article source filename is `<slug>.md`
  - generate `image-plan.md`
  - do not auto-generate or auto-implement images
  - only approved existing images may be implemented
  - never overwrite existing images
- Author persona facts allowed:
  - 磯貝アルト, 24歳
  - 飲食1年 → 第二新卒でIT/Webへ
  - 応募約30社、内定2社、年収350→400万円
  - 現職はAIO対策企業の法人営業
- Any first-person experience beyond those facts is forbidden.

## Architecture requirements

### 1. Separate domain

Create a separate domain such as `src/lib/article-factory/**` and separate API routes/UI. Do not force new-article creation through `phase4-action.ts`.

Use explicit types/schemas for:

- candidate batch
- candidate
- selected topic
- workflow phase/progress
- research source
- article draft/change set
- QA result
- publish result

### 2. Candidate generation

Implement new-article candidate generation that:

- reads the latest existing article inventory from the repository
- returns 3–5 candidates
- includes title, primary keyword, search intent, difference from existing content, reason to write now, and risk flags
- rejects obvious duplication/cannibalization
- excludes topics outside 第二新卒 × IT/Web転職
- never invents Search Console evidence when unavailable
- can be called manually from the internal dashboard
- has a protected daily Vercel Cron endpoint for 23:00 UTC (08:00 JST)
- verifies `Authorization: Bearer ${CRON_SECRET}`
- stores/retrieves the latest batch using an existing available durable surface if one already exists; do not introduce a paid external database or require a new integration without reporting `NEEDS_DECISION`

If durable storage cannot be implemented without a new service, still implement the generator, cron trigger, and a clean storage adapter with an in-memory/test adapter, clearly report the production storage blocker, and do not pretend persistence works.

### 3. Durable cloud execution

Use Vercel Workflow DevKit for the post-selection pipeline so it survives browser closure and supports retries/resume.

- Add the current compatible `workflow` packages.
- Read the installed documentation in `node_modules/workflow/docs/**` before coding.
- Use `"use workflow"` only for orchestration.
- Put Node/OpenAI/GitHub work in `"use step"` functions.
- Start the workflow from a protected API route and return a run ID immediately.
- Add a status API based on `workflow/api` so the dashboard can reconnect and display current phase.
- Serialize only plain supported data.
- Classify permanent failures with `FatalError` and transient failures with `RetryableError`.

Required ordered phases:

1. inventory
2. cannibalization
3. research
4. outline
5. write
6. internal-links
7. image-plan
8. qa
9. create-pr
10. publish

### 4. Research and content safety

- Research must use authoritative/current sources where claims are time-sensitive.
- Save source title, URL, retrieved date, and which claims it supports.
- Do not output invented citations.
- Never fabricate first-person experience.
- If the selected topic requires unsupported personal experience, QA must block publication.
- Preserve NARU's existing frontmatter/content format by inspecting current articles.
- Add internal links only to verified existing routes.
- Generate a Drive-compatible `image-plan.md`; do not generate images.

### 5. QA and publishing

QA must deterministically block publication for at least:

- cannibalization/duplicate intent
- missing or malformed required frontmatter
- broken internal links
- unsupported first-person claims
- missing sources for time-sensitive factual claims
- forbidden or out-of-scope paths
- build/typecheck failure
- any QA verdict FAIL or NEEDS_REVIEW

GitHub writes must:

- create a fresh branch per selected topic
- change only allowlisted article/article-run paths
- open a PR against `master`
- never push directly to `master`
- be idempotent for the same run ID
- refuse to overwrite an existing article slug

Implement the automatic-publication boundary explicitly, but default it off for this infrastructure PR. Auto-publication may occur only when all QA checks pass, build/typecheck pass, the PR contains only allowlisted paths, and an explicit server-side flag authorizes it. Otherwise leave the PR open and return the reason.

### 6. Internal dashboard UI

Add a distinct tab labelled `新規記事` in `/internal/dashboard`.

It must show:

- 3–5 candidate cards
- title / keyword / intent / difference / why now
- `この記事を作る` action
- phase progress: 調査中 → 構成作成 → 執筆 → 内部リンク → QA → 公開 → 完了
- run ID
- reconnect/resume after page reload
- blocking error reason
- final PR URL and production URL when available

The existing SEO Editor tab remains clearly labelled and functional.

### 7. Cron configuration

Update `vercel.json` without removing `"fluid": true`.

Add exactly one daily cron entry for the candidate endpoint at `0 23 * * *` (UTC = 08:00 JST).

### 8. Tests and validation

Add focused automated tests for pure safety logic where practical. At minimum cover:

- duplicate/cannibalization blocks
- unsupported personal-experience blocks
- QA FAIL and NEEDS_REVIEW block publication
- path allowlist
- slug overwrite refusal
- cron auth
- idempotent publish decision

Run:

- `npm ci`
- focused tests
- `npx tsc --noEmit`
- `npm run build`
- lint for changed/new files (existing unrelated lint debt may remain)

Inspect the built route table and confirm the new API/UI routes are present.

## Change boundaries

Allowed:

- `src/lib/article-factory/**`
- article-factory types/tests
- new internal API routes for candidates/start/status
- protected cron route
- internal dashboard components/navigation needed for the new tab
- `package.json` / lockfile for Workflow/test dependencies
- `vercel.json`
- documentation for env/config and operation
- `docs/agent-handoff/REPORT.md`

Do not:

- edit existing article content
- create a real article
- alter Search Console data
- weaken SEO Editor security
- commit secrets
- push to or merge `master`
- deploy production
- require the user to copy/paste Claude output
- edit `STATE.json` or `NEXT_INSTRUCTION.md`
- edit `.github/workflows/**` in this instruction

## Completion rule

Set REPORT status:

- `PR_READY` only if the infrastructure builds, typechecks, focused safety tests pass, and no production-critical persistence/runtime blocker remains.
- `NEEDS_DECISION` if a new external storage/integration, paid service, secret, or product decision is required.
- `BLOCKED` for an environmental blocker.
- `FAILED` for an implementation/test failure that could not be fixed safely.

REPORT must include exact tests, changed files, env names required (names only, never values), remaining risks, and a concrete next step.
