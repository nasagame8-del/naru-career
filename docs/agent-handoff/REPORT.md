# Claude Code Report

- reportId: `REPORT-011`
- completedInstructionId: `WAR-EV0C603KGV0X`
- status: `DONE`
- branch: `war-room/ev0c603kgv0x`

## summary

依頼「どんなnote書けばいいかな」は実装ではなく企画相談。コード変更なし。
`content/articles/`（55本）と `content/note-drafts/`（29本）を突き合わせ、記事はあるがnote下書きが未作成のもの（34本）から候補を選定した。Driveの01_Content（NARU-028〜057）の内容とも一致する。

note の既存方針（`self-introduction-note.md`）は「NARUの記事の裏話・カジュアルな体験談」。これに沿い、体験・感情が核で、サイト記事より一人称で書けるものを優先した。

### 推奨候補（優先順）

1. `second-new-grad-it-career-change`「IT未経験→3ヶ月で内定。やったことを全部書く」— 看板体験。noteでは失敗・迷い・時系列の生々しさを足す。
2. `small-trigger-to-quit`「転職を決めたきっかけは、実は些細なことだった」— 共感型。note向き。
3. `certification-exam-on-hold` / `promotion-blocked-by-boss` / `unfair-evaluation-not-spoiled` — 前職での評価・昇進の不満。3本を「前職で納得できなかった3つのこと」の連載にできる。
4. `agent-not-recommended` / `agent-comparison-2026` — 関心が高い。サイト記事は対処法中心なので、noteは「合わなかった担当者とのやりとり」の本音側に寄せる。
5. `pc8001-modern-it-job-application` — 遊びのある読み物。SNS拡散向き。
- 時事系（NARU-052〜057 の法改正・宇宙週間・年収調査など）は事実確認が重く、note転用の優先度は低い。

## tests and timings

未実施（コード変更なし）。

## changed files

`docs/agent-handoff/REPORT.md` のみ。

## git diff summary

REPORT.md の置き換えのみ。

## existing issues found

- 記事の frontmatter は全件 `note_published: false`。note公開済みの管理は記事側では追えない。実際に何がnote公開済みかは未確認。
- note下書き29本の中身との重複（例: `agent-free-and-cancel-note` と agent系）は題材単位でしか比較していない。

## remaining risks

- 候補は題材一覧からの判断で、各記事の本文は精読していない。
- 実体験に基づく内容は、書き手本人（磯貝アルト）の実際の経験と一致するか本人確認が必要。事実を創作しない。

## decisions needed

- 1本目を何にするか（推奨は 1 または 2）。
- Claudeに下書き（`content/note-drafts/<slug>-note.md`）を作らせるか。希望があれば新しいinstructionで実施可能。

## recommended next step

候補を1つ選んで指示する。下書きは既存note形式（frontmatter `type: "note"`, `original_slug`）で作成し、本人の実体験の細部は本人に確認する。

## Slack reply

noteのネタ案です。サイト記事はあるのにnote下書きが未作成のものから選びました。noteは「NARU記事の裏話・カジュアルな体験談」という既存方針に合わせています。

1. 「IT未経験→3ヶ月で内定」の裏側。迷いや失敗も含めて時系列で書く看板企画です。
2. 「転職を決めたきっかけは些細なことだった」。共感されやすい内容です。
3. 前職で納得できなかった3つのこと。資格試験の保留、昇進、評価への不満を連載にできます。
4. エージェントが合わなかった本音。サイト記事より担当者とのやりとりを具体的に書きます。
5. PC-8001の職務経歴書。遊びのある読み物で拡散向きです。

法改正や年収調査などの時事ネタは事実確認が重いので、noteでは後回しがおすすめです。

まず1か2から始めるのがよさそうです。選んでもらえれば下書きを作ります。体験の細部は本人確認が必要です。
