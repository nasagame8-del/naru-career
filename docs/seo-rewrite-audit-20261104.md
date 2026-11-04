# NARU リライト監査｜2026-11-04

reportId: USER-NARU-REWRITE-ALL-20261104
status: DRAFT_REVIEW / LEGACY_IMAGES_BLOCKED
base: 1b52ab6efc553b393c6af0361ceef5f07484d68c

## 実施

- 未反映の9監査PR、6内部リンクPR、早期離職PRを現行masterへ照合。36記事の修正を記事単位へ整理。
- 既存17PRを再利用、複数記事の残差は19PRへ分離。各branch差分が記事Markdown1本で、保存後読み戻しが一致することを確認。
- 早期離職は現行LiveDash公式経歴を根拠に時系列訂正。現行サイトで確認できない旧PRの断定を移植しない。
- 全76本のcanonical URL・noindexを直接確認。検索インデックス登録を検証したことにはしない。
- GSCの欠損行を0補完せず、公開後28日未満も分離。詳細数値はprivate report/WBSだけに記録。
- 直近11/2の改稿は確定GSCにpost期間が含まれず、観測を継続。固定アンカー修正後のMeasurement artifactを読み、後続改稿と切り分け。

## 検証

既存Vitest333件＋Node52件、TypeScript成功。統合状態のローカルbuildはexit0、76記事HTML生成。個別軽量QAと同headのArticle Factory Validation・Cloudflare Previewは7記事成功、29記事は既存の旧画像構成でWebP4枚・本文参照が不足。CIとユーザー目視は別ゲート。画像差し替え、master直接push、ゲート変更、マージは行っていない。

## Article PRs

| slug | PR | head | state |
|---|---|---|---|
| agent-comparison-2026 | [#108](https://github.com/nasagame8-del/naru-career/pull/108) | `f334c07ddcae9d80f086033ee36d4bfe5392aea6` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| agent-free-and-cancel | [#101](https://github.com/nasagame8-del/naru-career/pull/101) | `0fab73157c7070ebcfedf0ef6211af5ab5437f38` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| agent-referral-vs-self-apply | [#104](https://github.com/nasagame8-del/naru-career/pull/104) | `59ea9951f5e449b14c798a73faabf30bb1211cd0` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| agent-site-vs-agent-usage | [#233](https://github.com/nasagame8-del/naru-career/pull/233) | `2e600933b8a0f237dc357787439c35ddb5959bed` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| ai-interview-screening | [#237](https://github.com/nasagame8-del/naru-career/pull/237) | `29c5cf41c68ca80745483ce0a30991fb447c8b9f` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| aio-seo-industry-inside | [#239](https://github.com/nasagame8-del/naru-career/pull/239) | `a5087950d5bdf2dc416bb3ec9d56920e67d85606` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| alumni-hiring | [#102](https://github.com/nasagame8-del/naru-career/pull/102) | `012dd4af76412cc939f9309e5e41e177e5b62885` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| bizreach-second-new-grad | [#240](https://github.com/nasagame8-del/naru-career/pull/240) | `7d277a875ee776fef199bceb008e63f4e91b445d` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| casual-interview | [#162](https://github.com/nasagame8-del/naru-career/pull/162) | `83365cb92188b6a573035c432dc3c5d3a9322ae3` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| direct-recruiting | [#241](https://github.com/nasagame8-del/naru-career/pull/241) | `b8a26c53a7697ef002927c1c233059a9b580b5f4` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| how-to-resign-experience | [#223](https://github.com/nasagame8-del/naru-career/pull/223) | `891b6bc43d0f8008058b6677f7b5cbbb95757995` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| interview-failure-why-this-job | [#243](https://github.com/nasagame8-del/naru-career/pull/243) | `dd52565b775447136661ff967ef5aa2a04e61997` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| it-industry-quit-myth | [#244](https://github.com/nasagame8-del/naru-career/pull/244) | `a890dfbcdb8ea6cf67c5add19ee531664ea78762` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| it-training-program-job-checklist | [#112](https://github.com/nasagame8-del/naru-career/pull/112) | `263279f5d049860be3bee7f444957510429ef998` | STATIC_QA_PASS_PREVIEW_REVIEW |
| job-change-timing-3months | [#245](https://github.com/nasagame8-del/naru-career/pull/245) | `bd5e231b8c515027f7a8c9222eca882547484e3c` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| job-type-employment | [#246](https://github.com/nasagame8-del/naru-career/pull/246) | `6aed406b140428251ca8841f944faca76b1b790c` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| new-grad-early-resignation-career-plan | [#186](https://github.com/nasagame8-del/naru-career/pull/186) | `02104d9643d6a7261811c2dff78d0c601c54395c` | STATIC_QA_PASS_PREVIEW_REVIEW |
| recruitment-agency-business-model | [#247](https://github.com/nasagame8-del/naru-career/pull/247) | `893206dc63fa4b96d5637352f68307e04d0a5af6` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| reference-check-explained | [#105](https://github.com/nasagame8-del/naru-career/pull/105) | `ddde9c104e1d4aad3ff8787cf16b078415d0c71e` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| referral-hiring | [#248](https://github.com/nasagame8-del/naru-career/pull/248) | `f838c6f2d90c3123d2db564c483a5bb6ea6c15d1` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| resume-writing-second-new-grad | [#109](https://github.com/nasagame8-del/naru-career/pull/109) | `6f010fb50e69adb260fee6b8dbc062dbc180fd6b` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| second-new-grad-it-career-change | [#249](https://github.com/nasagame8-del/naru-career/pull/249) | `f7dfec16d7e41c12bcafa138b4a0a1bce622a12d` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| second-new-grad-it-company-research | [#160](https://github.com/nasagame8-del/naru-career/pull/160) | `7e72e71e65a3cb14c33e1869d605064a8c6e003e` | STATIC_QA_PASS_PREVIEW_REVIEW |
| second-new-grad-it-interview-questions | [#164](https://github.com/nasagame8-del/naru-career/pull/164) | `0b80fec5e73f2412f90a7eb0868e799fb44331ca` | STATIC_QA_PASS_PREVIEW_REVIEW |
| second-new-grad-it-offer-acceptance-checks | [#163](https://github.com/nasagame8-del/naru-career/pull/163) | `0c4b2904cbf3f6e25aa97883f83261d2b4fa4f78` | STATIC_QA_PASS_PREVIEW_REVIEW |
| second-new-grad-it-portfolio-guide | [#161](https://github.com/nasagame8-del/naru-career/pull/161) | `c09f5352644ae65e41dbb60817b6adbd18ad4f11` | STATIC_QA_PASS_PREVIEW_REVIEW |
| second-new-grad-job-change-traps | [#250](https://github.com/nasagame8-del/naru-career/pull/250) | `50a52b0c14c1eaf2a4ee36de26aba391b06f7009` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| second-new-grad-programming-career-change | [#251](https://github.com/nasagame8-del/naru-career/pull/251) | `204a9aa27634c620978056dc5a03a3e598a8e223` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| second-new-grad-retirement-pay | [#110](https://github.com/nasagame8-del/naru-career/pull/110) | `320d8558e7c47e0a7d8cc539c1509e2d104ed545` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| second-new-grad-web-marketing-career | [#252](https://github.com/nasagame8-del/naru-career/pull/252) | `0f8475b1c8da69c0744becf7bf7f0ae459900546` | STATIC_QA_PASS_PREVIEW_REVIEW |
| ses-explained | [#107](https://github.com/nasagame8-del/naru-career/pull/107) | `1ce0b157927cc5812b7b5076639bcad7bcc4fad1` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| skill-based-hiring | [#253](https://github.com/nasagame8-del/naru-career/pull/253) | `16f10283c44dc580fde8955c777d4b1868f0e3df` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| vaguely-want-to-quit | [#165](https://github.com/nasagame8-del/naru-career/pull/165) | `add4493377b52a38918c382014efc4a281af27a3` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| web-industry-guide | [#254](https://github.com/nasagame8-del/naru-career/pull/254) | `7525434db56c5d1f750c90baf1f3f516859672cc` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| what-is-second-new-grad | [#255](https://github.com/nasagame8-del/naru-career/pull/255) | `8161f6ac43e71edfbee42a954e95fd0be3a8250f` | HELD_LEGACY_IMAGE_REQUIREMENTS |
| what-is-web-industry | [#256](https://github.com/nasagame8-del/naru-career/pull/256) | `312ab591cc17d63e3b2b6af2e73068984a586f77` | HELD_LEGACY_IMAGE_REQUIREMENTS |

## 次の工程

- 7記事の同headプレビューをユーザー確認。独立Human Fact Checkと公開指示を別途確認。
- 29記事の旧画像はユーザー指定と現行ルールを確認して対処。無断で画像を生成・差し替えない。
- 低表示・未返却記事はURL検査とquery×pageで原因を分離し、削除・統合を自動決定しない。
- 既存のSEO定期確認へ今回の監査と11/7〜14の観測を引き継ぐ。
