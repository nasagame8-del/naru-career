# NARU RPG mock implementation — 2026-10-10

Base: master 84dc5721e2743e6d64ac01bc6a126be0a69207bf. Branch: feat/shindan-faithful-rpg-mock. PR179 was inspected as an old prototype, not merged/cherry-picked. User's six-panel collage is the visual reference, not a page-sized implementation asset.

## Preserved contract
- `_lib/matching.ts`, `_lib/data.ts`, `_lib/cta-data.ts`, `_lib/analytics.ts` remain unchanged.
- 20 binary questions, four preference axes, all 16 class mappings retained.
- Result share functions, X/native/image-download events, type links, article/survey/affiliate CTAs and disclosure remain in ResultContent.
- Layout metadata and result/type routes retained. Added layout CSS import only.
- No invented numeric abilities or radar chart. Status tabs show existing descriptions, good/bad environments, job categories and career advice.
- All old image files retained. Atlas used by the archive remains the original official characters. New painted atlas only supports the large result portrait.

## Scene/component map
1. Title: world backdrop, parchment, compass emblem + accessible DOM wordmark, information strip, signboard menu, blue/gold command.
2. Quiz: guild backdrop, real progressbar, parchment question, guide illustration, command buttons, dialogue panel. Answer lock prevents duplicate answers; 180ms transition.
3. Analysis: laboratory backdrop plus separate crystal asset; 900ms maximum cosmetic transition, no fabricated progress percentages; immediate result under reduced motion.
4. Result: official class name, illustrated portrait, description on parchment, job tags, retained share/CTA section.
5. StatusDetails: parchment and four keyboard-operable tabs. Left/right/Home/End and aria-selected/tabpanel.
6. Archive: official 16 names and sprites, four columns desktop and two columns mobile, each links to existing /types/slug.

## Visual review log
- Pass 1: PC title composition close; guide too small/low, large void between commands and guide. Enlarged/raised guide. Added painted portraits preserving official class identities.
- Pass 2: old circular avatar frame and centered result styling leaked through. Parchment transparent image gutters placed archive/status headings outside paper. Removed old result framing; corrected paper background sizing and padding.
- Pass 3: result atlas bled neighboring feet at row boundaries; regenerated atlas with gutters. Added early scene/crystal preloads so 900ms analysis does not race image downloads. Mobile guide raised again.
- Final verification and outstanding differences will be recorded after final capture.

## Preview
Dedicated same-repository pull_request workflow builds and deploys `naru-pr-<PR>-shindan-preview`; no production binding, routes or production secrets copied. Responses are noindex/nofollow; API/internal/member/write operations blocked. Master deployment workflow is untouched. Never merge or publish production without user's visual approval.
