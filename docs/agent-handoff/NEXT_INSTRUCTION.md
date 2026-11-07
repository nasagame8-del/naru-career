# Next Instruction

- instructionId: `NONE`
- issuedBy: `ChatGPT`
- target: `Claude Code`
- status: `IDLE`
- mode: `CLOUD_CLAUDE_BRIDGE`

## Current state

No Claude task is active on master.

To start a task, ChatGPT must first create or reuse a dedicated task branch and Draft PR, then update that branch's `STATE.json` to `status: RUN_CLAUDE` with a new unique `instructionId`.

After writing a concrete instruction here, ChatGPT triggers the cloud worker by commenting on that PR:

```
@naru-autopilot <instructionId>
```

Claude must execute only that instruction, update `REPORT.md`, and stop. ChatGPT reviews the resulting diff and tests before deciding whether a second instruction is needed.

## Default limits

- `maxClaudeTurns`: 8
- workflow hard cap: 8
- autonomous review/implementation rounds: 2
- no recursive self-trigger
- no direct push to master
- no production merge/deploy without the normal NARU gates and required approval

## UI decoration review — USER-UI-DECORATION-20261005

User requested implementation using the Xserver readability article as reference. Authorized: dedicated `ui/article-decoration-refresh` branch, Draft PR, isolated Cloudflare preview. No master push, merge or production deploy. No Claude task is requested.


## USER-ARTICLE69-DATE-20261010
ユーザーの「それ直して」に基づき、記事69のdatePublished/dateModifiedを実公開日2026-10-09へ修正する。専用PR作成、同head CI確認、squash mergeとCloudflare本番検証を許可。本文・画像・他PRは変更しない。Claudeタスクは起動しない。

## USER-SHINDAN-RPG-PUBLISH-20261010
ユーザーが「公開していいよ細かい修正はこっちでする」と明示承認。PR #180のReady化、masterへのPR経由マージ、Cloudflare本番デプロイ、実際の /shindan の確認を許可。追加のUI修正・他PRのマージは行わない。master直接pushなし。Claudeタスクは起動しない。

## USER-NARU073-CATEGORY-FIX
ユーザー「修正してすぐ」に基づき記事73のcategoryを独自調査から業界解説へ修正する。専用PR作成、CI確認、head固定squash merge、Cloudflare本番確認を許可。本文・画像・他記事は変更しない。Claude起動なし。

## USER-HIDE-RPG-CTA-20261014
ユーザー「RPG診断のCTA全部非表示にしといて」。専用PRで全サイトのRPG診断CTAを非表示にし、CI確認後head固定squash mergeとCloudflare本番反映・検証を許可。master直接push・Claude起動なし。


## USER-SEASONAL-20261104-82
ユーザー指示により記事82の本文、出典確認、画像プラン・プロンプト、専用ブランチとDraft PRを許可。master直接push、merge、本番deployは行わない。Claudeタスクは起動しない。


## USER-SEASONAL-20261104-83
ユーザー指示により記事83の本文、出典確認、画像プラン・プロンプト、専用ブランチとDraft PRを許可。master直接push、merge、本番deployは行わない。Claudeタスクは起動しない。

## USER-INTERNAL-LINK-20261106
ユーザー指示に基づき、業務委託の関連記事への本文リンク追加とDraft PRを許可。プレビュー確認後に公開判断。

## USER-SIDEBAR-AD-20261107
ユーザーの添付写真の丸印に基づき、著者紹介直下の右サイドバーへ広告を配置する。保存済み最多表示記事 offer-letter-before-acceptance-not-provided にユーザー提供KOSMOバナーと計測画像を設定する専用ブランチ・Draft PR・Cloudflareプレビューを許可。既存のスマホ非表示を維持。master直接push、未承認のmerge/本番公開、Claude起動は行わない。

## USER-AD-EXPANSION-20261107
ユーザー「増やせるところは増やして。横に広告入れるやつも増やしたい」に基づき、既存PR #263を再利用し広告の明示的記事別マッピング、原寸300×250サイドバー、スマホ記事末尾を実装・検証する。24記事+通知書へKOSMO、既掲載の兼業・競業記事へAnycrew横枠。既存広告PRの本文変更を重複させない。Draft PR更新とプレビューは許可。表示変更後の同head目視承認前はマージ・本番公開しない。


## USER-AUTHOR-BIO-20261107
ユーザー「OK。それの方針でやろう」に基づき、著者情報をSEO・AIO法人営業の経験、人材業界への転職決定・内定承諾済み・入社前へ更新する。勤務先名は掲載しない。初回転職実績の350→400万円・約30社・2社内定は初回と明記。専用fixブランチ・Draft PR・既存CloudflareプレビューとQAを許可する。公開は新headのプレビュー目視承認後。記事候補は提案のみ、選択前に記事化しない。master直接push・Claude起動なし。


## USER-AUTHOR-CORRECTION-20261107
ユーザーの明示修正「内定を承諾し入社を控えていますってのいらない」「ビズリーチ人材業界じゃないし」を優先。著者ページ・サイドバー・JSON-LDの転職先表現を「IT/Web企業への転職が決まりました」に訂正し、内定承諾・入社前の説明を削除する。既承認の著者更新への指定文言訂正として専用PR、CI/Cloudflare検証、PR経由マージ、本番確認を許可。勤務先名は非掲載。その他記事制作は未選択のまま。


## USER-ARTICLE086-20261107
ユーザーが会社選びの実体験記事の構成に「OKやって」。記事86（second-career-change-job-selection-axis）の原稿、調査、画像4枚の完成プロンプト、専用ブランチ・Draft PR・Drive保存を許可。提供素材と本人の最新発言を優先。勤務先・担当者実名と個別金額は非掲載。AI面接対策の記事は未選択。画像未受領、本人による体験内容確認・Human Fact Check・最新headのCI/Cloudflare Preview・ユーザー目視承認前はmerge/予約/公開禁止。Claude起動なし。


## USER-ARTICLE086-REWRITE-CHATGPT-20261107
ユーザーの追加指示に従い、既存PR273を再利用。ChatGPTに何を伝え、問い返しで何を整理し、どの資料や会社説明と照合したかを具体化する。質問例は読者向け例と明記。議事録等の取得には言及しない。画像4枚は維持。改訂版へのユーザー目視確認前はmerge・公開禁止。

## USER-ARTICLE086-PUBLISH-20261107
改訂版にユーザー「いいんじゃない？」と承認。PR273 head e0501a860fd89f261b7708cd7cacc84fbd2fe353のReady化、expected_head_sha固定squash merge、Cloudflare本番deployと実URL/画像確認を許可。本文変更・master直接push・他PR操作なし。
