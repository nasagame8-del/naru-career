# Next Instruction

- instructionId: `INST-001`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `ACTIVE`

## 目的

現在実行中の「全修正適用後 E2E 3回目」を完了し、その結果をGitHub上の `docs/agent-handoff/REPORT.md` に残してください。

これ以降、長い結果を人間にコピペさせないことを前提にします。

## 今回やること

1. 現在実行中のE2Eを最後まで完了する。
2. 以下をREPORTへ記録する。
   - Phase 1〜9 の各実行時間
   - Phase 7がtimeoutしなかったか
   - QA最終結果
   - PRE_EXISTINGのみの場合にFAILしないこと
   - 新規broken link fixtureがFAILになること
   - frontmatter diffが0であること
   - lostSegments
   - Phase 8の計画外本文変更の有無
   - FAIL時publish blockが維持されていること
   - lint / build結果
   - 変更ファイル一覧
   - git diff概要
3. すでに調査済みの `/diagnosis` 問題もREPORTへ記載する。
   - 旧Route削除後、Markdown 15本の `](/diagnosis)` が残っている
   - 正しい置換先は `/shindan`
   - `/agent-diagnosis` は別機能
   - この問題はSEO Editor本体の変更には混ぜていない
4. BASE_BRANCHについて、調査済み事実をREPORTへ記載する。
   - GitHub default branch = `master`
   - `master` = 28記事
   - `work` = 37記事
   - VercelはGit連携されておらずCLI deploy
   - 現状masterをbaseにすると9記事分の差分が混入する
5. MERGE経路が未検証なら、そのまま未検証と明記する。

## 今回やらないこと

- push
- PR作成
- merge
- production deploy
- `master` への統合
- `/diagnosis` 15記事の一括修正
- MERGE経路を無理に発生させるためのデータ変更
- 追加の大規模リファクタ

## REPORT.md 書式

最低限、以下を含めてください。

```md
# Claude Code Report

- reportId: REPORT-001
- completedInstructionId: INST-001
- status: DONE | NEEDS_DECISION | BLOCKED | FAILED
- branch: work

## Summary

## E2E Results

## QA Results

## Changed Files

## Git Diff Summary

## Existing Site Issues

## Base Branch Findings

## Remaining Risks

## Decisions Needed

## Recommended Next Step
```

完了したら `REPORT.md` を更新して停止してください。次の判断はChatGPT側で行います。
