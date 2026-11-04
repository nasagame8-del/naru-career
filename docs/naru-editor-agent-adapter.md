# NARU Editor Agent｜Evidence Adapter

## 役割

この層は、接続済みツールで取得した事実を `editor-agent/state:data/editor-agent/run-YYYY-MM-DD.json` へ反映するための運用契約です。
LLMが未確認値を推測して埋めるための仕組みではありません。

## 正本

- 候補・選択: `article-factory/candidates:data/article-candidates/*`
- 記事・PR・head SHA・CI・merge SHA: GitHubの実状態
- 画像・プロンプト・原稿保存先: Google Driveの実ファイル/フォルダ
- Preview: 対象PR head SHAのCloudflare article preview
- Fact Check: 人間確認が明示された記録のみ
- Production: merge SHAの `Deploy NARU to Cloudflare` 成功 + 実記事URL確認

## Reconcile規則

1. 毎回既存manifestを先に読む。無ければ当日分だけ作る。
2. slot 1/2は当日の選択順に固定し、過去日の予約記事を混ぜない。
3. candidateId / articleId / slugが既存値と衝突したら停止する。
4. `latestHeadSha` が変わったら、古いSHAに紐づく imageQa / articleQa / ci / factCheck / preview承認を合格扱いしない。
5. user approvalは対象head SHAが完全一致するときだけ `previewApprovedHeadSha` に記録する。
6. AIの一次情報照合だけで `factCheck.passed=true` にしない。
7. merge済みでも、必須ゲートの記録不足・SHA不一致があればblockerとして残し、完了扱いにしない。
8. ProductionはCloudflare deploy成功だけでは足りず、実記事URL確認が取れたときだけ `publicArticleVerified=true`。
9. 不明値は省略する。pendingをpassedへ変換しない。
10. 更新後は必ずGitHubからmanifestをreadbackし、State Validationの結果も確認する。

## コスト

OpenAI API、Anthropic API key、Google Ads Keyword Planner、Semrush/Ahrefs等の有料APIをこのadapterから呼ばない。
Claude Codeを使う場合も既存OAuth利用枠だけを使い、編集上のhuman gateをClaudeへ委譲しない。
