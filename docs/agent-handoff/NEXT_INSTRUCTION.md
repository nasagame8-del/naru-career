# Next Instruction

- instructionId: `WAR-EV0C5ZBECZ0F`
- issuedBy: `NARU ChatGPT / Slack War Room`
- target: `Claude Code`
- status: `ACTIVE`
- mode: `SLACK_LIVE_WAR_ROOM`

## Slack trace

- eventId: `Ev0C5ZBECZ0F`
- channel: `C0C71TPTSHW`
- messageTs: `1790988424.215869`

## User request

Claudeと議論して、このWar Roomの受信・委譲フローに安全性や運用上の穴がないか確認して。修正が必要ならDraft PRで実装して。本番公開・mergeはしないで。

## ChatGPT initial position

私の見立てでは、受信内容の信頼境界、委譲時の権限・入力検証、失敗時の挙動、重複実行や監査ログを重点的に点検すべきです。Draft PRまでに留め、本番公開・mergeは行いません。

## Claude assignment

NARUのWar Room受信・委譲フローを調査し、安全性と運用上の穴をレビューしてください。まず独立に脅威モデルと問題候補を整理し、上記の観点（Slack入力の信頼境界とprompt injection、委譲条件の判定、出力/schema検証、権限・秘密情報、再試行/重複実行、タイムアウト・失敗時のfail-closed動作、監査ログ/個人情報、レート制限とコスト、テスト/監視）を確認。私の見立てにも反論・検証し、既存実装とテストを根拠に優先度付きで報告してください。必要な修正は最小限の安全な範囲で実装し、回帰テストを追加・実行してDraft PRを作成してください。既存のNARU安全ゲートを迂回せず、外部有料APIを新規利用せず、merge・production deploy・公開は絶対に行わないでください。不可逆または曖昧な変更は実施せず、確認が必要なら止めて報告してください。

Before implementing, explicitly challenge ChatGPT's initial position:
1. state what is correct,
2. state what is risky or wrong,
3. propose the safest implementation approach.

Then make only safe, scoped changes needed for this request, run relevant tests, update `docs/agent-handoff/REPORT.md`, and stop.

## Hard boundaries

- Do not edit `STATE.json` or `NEXT_INSTRUCTION.md`.
- Do not push directly to master/main.
- Do not merge any PR.
- Do not deploy production.
- Do not expose or request secret values.
- Do not add or call paid external APIs.
- Preserve existing NARU article/publication/preview approval gates.
- If a destructive, credential, irreversible, or ambiguous decision is required, stop with REPORT status `NEEDS_DECISION`.
- Maximum workflow budget remains 8 Claude turns and 15 minutes.
