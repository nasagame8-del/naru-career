# Next Instruction

- instructionId: `NARU-EDITOR-V1-001A`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `CLOUD_CLAUDE_BRIDGE`
- branch: `agent/naru-editor-agent-v1`

## Context

The previous attempt `NARU-EDITOR-V1-001` hit the workflow's 8-turn cap before it could commit. Do **not** try to implement the whole agent in this round.

Build only the deterministic core for **NARU Editor Agent v1**. Keep the scope small enough to finish within this run.

Read AGENTS.md first. Production is Cloudflare Workers. Do not modify `.github/workflows`. Do not call paid APIs. Do not edit article content.

## Required work for this round

Create a focused module under `src/lib/naru-editor-agent/` implementing a pure, JSON-serializable editorial state model.

### Data model

Support one daily run with two independent article slots (order 1 and 2).

Run-level states must cover:
- CANDIDATE_RESEARCH_PENDING
- WAITING_SELECTION
- ACTIVE
- COMPLETED
- HELD

Article slot states must cover:
- UNSELECTED
- SELECTED
- DRAFTING
- WAITING_IMAGES
- IMAGE_QA
- ARTICLE_QA
- WAITING_PREVIEW_APPROVAL
- READY_TO_SCHEDULE
- SCHEDULED
- PUBLISHING
- PUBLISHED
- HELD

Each article slot must be able to carry, when known:
- order
- batchId / candidateId
- articleId
- slug / title
- branch / prNumber / prUrl
- latestHeadSha
- previewApprovedHeadSha
- Drive article/images/prompt IDs
- image slots card/01/02/03
- requestedPublishAt
- QA/CI gate booleans tied to latestHeadSha
- mergeSha
- productionDeployVerified
- publicArticleUrl
- publicArticleVerified
- blockers
- timestamps

Use optional/null fields safely so old/incomplete manifests can be parsed without invented values.

### Pure transition/evaluation rules

Implement pure functions that derive the slot state and next action from normalized facts. Do not perform network or filesystem I/O in the core.

Mandatory rules:
- selection is never inferred
- all 4 image slots are required before image completion
- preview approval is valid only when `previewApprovedHeadSha === latestHeadSha`
- if latestHeadSha changes, old approval cannot advance the slot
- READY_TO_SCHEDULE requires article QA pass + latest-head CI pass + valid preview approval
- SCHEDULED requires an explicit requestedPublishAt
- merge alone is not PUBLISHED
- PUBLISHED requires mergeSha + productionDeployVerified + publicArticleUrl + publicArticleVerified
- a blocker produces HELD and preserves completed facts
- repeated evaluation is deterministic/idempotent
- slot 1 and slot 2 do not block each other's progress

Expose a small function such as `evaluateArticleSlot()` that returns:
- state
- nextAction
- humanGate: "selection" | "images" | "preview-approval" | null
- reasons

Also expose a run evaluator that summarizes the two slots.

### Tests

Add unit tests covering at least:
1. unselected slot
2. selected -> drafting/waiting images
3. 3 images is not enough
4. 4 images advances
5. approval SHA mismatch blocks
6. approval SHA match + QA/CI passes => ready
7. requested publish => scheduled
8. merge without production verification is not published
9. production verified + real URL verified => published
10. blocker => held
11. two slots progress independently
12. repeated evaluation gives identical result

Use existing Vitest style if appropriate.

Run only:
- the new targeted test file
- `npx tsc --noEmit`

Do **not** run the full build in this round.

### Documentation

Add only a short `docs/naru-editor-agent-v1.md` describing:
- purpose
- state model
- the three human gates: select 2 articles, provide 4 images, approve exact preview SHA
- Cloudflare as production source of truth
- no paid API fallback
- round 2 will add repository manifest/CLI/adapters

### Safety

- no production actions
- no PR merge
- no master push
- no workflow edits
- no article edits
- no secrets
- no paid APIs
- <= 10 changed files

Before finishing, replace `docs/agent-handoff/REPORT.md` with the required concise report and include a Japanese `## Slack reply` section.

## Success condition

Finish this round with the core state model + tests committed by the workflow. Do not expand scope beyond that.