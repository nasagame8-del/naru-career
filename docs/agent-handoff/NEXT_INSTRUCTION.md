# Next Instruction

- instructionId: `WAR-EV0C5ZBECZ0F`
- issuedBy: `NARU ChatGPT / Slack War Room`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `SLACK_LIVE_WAR_ROOM`
- iteration: `1/2`

## Slack trace

- eventId: `Ev0C5ZBECZ0F`
- channel: `C0C71TPTSHW`
- messageTs: `1790988424.215869`

## User request

Claudeと議論して、このWar Roomの受信・委譲フローに安全性や運用上の穴がないか確認して。修正が必要ならDraft PRで実装して。本番公開・mergeはしないで。

## ChatGPT initial position

受信内容の信頼境界、委譲時の権限・入力検証、失敗時の挙動、重複実行、監査ログを重点的に見るべきだと考える。

## Round 1 — critic only

この第1ラウンドは**反論・監査・結論だけ**に限定する。実装ファイルは変更しない。

確認対象を次のファイルに限定する。

- `src/app/api/slack/events/route.ts`
- `src/lib/war-room/slack.ts`
- `src/lib/war-room/planner.ts`
- `src/lib/war-room/github.ts`
- `.github/workflows/naru-agent-autopilot.yml`
- `.github/workflows/naru-war-room-relay.yml`
- `src/lib/war-room/slack.test.ts`
- `docs/agent-handoff/README.md`

やること:

1. ChatGPTの見立てに対して、正しい点・見落とし・過剰な点を明示的に反論する。
2. P0 / P1 / P2 で具体的な問題を最大5件に絞る。
3. 各問題について「根拠となるファイル/挙動」「修正案」「自動修正してよいか」を示す。
4. 実装はまだしない。テストも新規実行しない。
5. `docs/agent-handoff/REPORT.md` を、このInstruction専用の簡潔なレポートに置き換えて終了する。

**最優先は8ターン上限より前にREPORTを完成させて正常終了すること。**
深掘りより、まず返答を完成させる。追加調査が必要ならREPORTにremaining risksとして残す。

## REPORT requirements

- reportId: `REPORT-WAR-EV0C5ZBECZ0F-R1`
- completedInstructionId: `WAR-EV0C5ZBECZ0F`
- status: `PR_READY` if safe concrete fixes exist, otherwise `DONE` or `NEEDS_DECISION`
- branch
- ChatGPTへの反論
- P0/P1/P2 findings（最大5件）
- proposed fixes
- implementation recommendation
- remaining risks
- recommended next step

## Hard boundaries

- Do not edit `STATE.json` or `NEXT_INSTRUCTION.md`.
- Do not edit implementation/test/workflow files in this round.
- Only `REPORT.md` may be changed.
- Do not push to master/main.
- Do not merge or deploy production.
- Do not expose or request secrets.
- Do not call paid external APIs.
- Stop as soon as REPORT is complete.
