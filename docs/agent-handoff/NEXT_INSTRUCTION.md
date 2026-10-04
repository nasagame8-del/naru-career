# Next Instruction

- instructionId: `NARU-EDITOR-V1-001`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `CLOUD_CLAUDE_BRIDGE`
- branch: `agent/naru-editor-agent-v1`

## Goal

Implement the first usable version of **NARU Editor Agent v1** inside this repository.

The user wants the NARU content workflow to be as autonomous as safely possible. The human should remain responsible only for:
1. choosing the two daily article candidates,
2. generating/providing the four images per article,
3. explicitly approving the actual article preview.

Everything else should be representable as deterministic machine state and safely resumable.

This is a control-plane implementation task, not an article-writing task.

## Current production assumptions

- Production source of truth is Cloudflare Workers, not Vercel. Read AGENTS.md first.
- Do not reintroduce Vercel as a required production gate.
- Existing morning candidate scoring now uses GSC + free web signals; paid keyword APIs are not required.
- Existing Google Ads Keyword Planner PR #121 was abandoned.
- Do not use OpenAI API, Anthropic API-key billing, Google Ads Keyword Planner, Semrush API, Ahrefs API, or any other paid research/generation API.
- This Claude run itself is OAuth-authenticated and may be used.
- Do not modify .github/workflows in this instruction; the observer intentionally protects them.

## Required implementation

### 1. Persistent editor-agent state model

Create a small, explicit, JSON-serializable state model for a daily NARU editorial run. Prefer a new module under `src/lib/naru-editor-agent/`.

It must be able to represent at least:

- candidate research pending
- candidates ready / waiting for user selection
- selected
- drafting/research
- waiting for images
- image processing / image QA
- article QA
- preview ready
- waiting for exact user preview approval
- ready to schedule
- scheduled
- publishing
- published
- held / blocked

A daily run must support two independently progressing article slots (order 1 and 2) with:
- date JST
- candidateId / batchId
- articleId
- slug/title
- branch / PR number / PR URL
- exact latest head SHA
- exact preview-approved head SHA
- Drive article/images/prompt IDs when available
- image slots card/01/02/03
- requested publish time
- merge SHA
- production URL
- blocker(s)
- timestamps / last reconciled time

Do not treat logs as truth when repo/queue state disagrees.

### 2. Deterministic transition rules

Implement pure functions that answer:
- current state
- next allowed state/action
- whether a human gate is required
- why a transition is blocked

Hard rules:
- no candidate selection inferred from silence
- no image completion unless all four expected images are accounted for
- no preview approval unless the approved SHA exactly matches current head SHA
- any content/image commit after approval invalidates the preview approval
- no scheduling/publish-ready state unless article QA and latest-head CI gates are recorded as passing
- no publish-success state from merge alone; production deploy + real article URL verification are required
- do not silently skip a failed/unverified gate
- operations must be idempotent; repeated reconciliation must not duplicate article/PR/Drive identities
- article 1 and article 2 progress independently

### 3. Repository-backed run manifest

Define a concrete versioned JSON shape and path convention under `data/editor-agent/`, e.g. `run-YYYY-MM-DD.json`.

Add parse/validate/serialize helpers. Keep existing `selected-queue-YYYY-MM-DD.json` as an upstream source of truth for selections; do not replace or mutate its existing schema merely to make this feature convenient.

Provide a reconciler that can accept a normalized evidence object (candidate queue facts, PR facts, CI facts, image facts, preview approval facts, production facts) and update the run manifest deterministically. Keep external API fetching out of the pure core.

### 4. CLI for operators / automation

Add a script and package.json command, ideally `npm run editor-agent -- ...`, supporting at least:
- `status --date YYYY-MM-DD`
- `reconcile --date YYYY-MM-DD --evidence <json file>`
- `next --date YYYY-MM-DD`

The CLI must not call paid APIs and must not publish/merge anything. It is a safe local/control-plane tool.

Output should be concise and machine-readable enough for ChatGPT/automation to consume.

### 5. Tests

Add thorough unit tests for:
- two-slot independent progress
- selection gate
- four-image gate
- approval SHA invalidation
- QA/CI gate
- schedule gate
- merged-but-not-production-verified state
- published state
- idempotent reconciliation
- blocked/held reasons
- backward-safe handling of absent optional fields

Run:
- targeted tests
- full `npm test`
- `npx tsc --noEmit`
- `npm run build`

If full build is blocked by a known environment-only issue, report it precisely; do not claim success.

### 6. Documentation

Add `docs/naru-editor-agent-v1.md` describing:
- architecture
- human gates
- state diagram
- data ownership/source-of-truth rules
- how ChatGPT should supply web/GSC/Drive/GitHub evidence
- how Claude Code is used only as an implementation worker
- how the future scheduler/publish adapter should connect without weakening gates
- Pro-friendly usage constraints: bounded Claude turns, no automatic paid-API fallback, stop on quota/rate limit instead of spending extra

Update existing docs only where necessary; do not rewrite unrelated historical docs.

## Scope constraints

- No article content generation in this instruction.
- No production merge/deploy.
- No direct push to master.
- No changing existing article files.
- No secrets.
- No .github/workflows modifications.
- No disabling existing safety gates.
- Do not delete the current Article Factory / handoff infrastructure; reuse or coexist with it.
- Keep the change set focused and preferably <= 20 files.

## Success criteria

This instruction is DONE only if the branch contains a tested, documented, deterministic state-machine/control-plane implementation that can be used by a later GitHub/ChatGPT scheduler adapter without redesigning the state model.

If architecture conflicts with the current repository are found, choose the smallest compatible design and document the decision in REPORT.md. If a safe implementation is impossible, stop with NEEDS_DECISION rather than inventing missing behavior.

## Slack reply

Summarize for the user in Japanese what was implemented, test status, and what remains for round 2.