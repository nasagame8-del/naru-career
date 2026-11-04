# NARU Editor Agent v1

## 目的

毎日2本の記事を、人間の判断を3か所に絞って公開まで進めるための編集状態モデル。
`src/lib/naru-editor-agent/` に純粋関数として実装（I/Oなし、JSONシリアライズ可能）。

## 状態モデル

- Run: `CANDIDATE_RESEARCH_PENDING` / `WAITING_SELECTION` / `ACTIVE` / `COMPLETED` / `HELD`
- Slot（order 1・2は独立。片方が止まってももう片方は進む）:
  `UNSELECTED` → `SELECTED` → `DRAFTING` → `WAITING_IMAGES` → `IMAGE_QA` → `ARTICLE_QA` →
  `WAITING_PREVIEW_APPROVAL` → `READY_TO_SCHEDULE` → `SCHEDULED` → `PUBLISHING` → `PUBLISHED`（`HELD` は任意の段階から）
- `evaluateArticleSlot(facts)` は `state / nextAction / humanGate / reasons` を返す。`evaluateRun(facts)` は2スロットを集約する。
- 不明な値は null/省略のまま扱い、推測で埋めない。blockerがあれば `HELD`（確定済みの事実は保持）。

主なルール: 選択は推測しない／画像は card・01・02・03 の4枚必須／QA・CI・Fact Checkは最新headSHAに対する結果のみ有効／
`previewApprovedHeadSha === latestHeadSha` のときだけ承認有効／人間のFact Checkが同じhead SHAに対して記録されるまで `READY_TO_SCHEDULE` に進めない／`SCHEDULED` は明示的な `requestedPublishAt` が必要／
`PUBLISHED` は mergeSha + 本番デプロイ確認 + 公開URL + 公開URL確認が揃うまで成立しない（mergeだけでは `PUBLISHING`）。

## 人間のゲート（3つ）

1. 記事2本の選択
2. 記事ごとの画像4枚の提供
3. 正確なpreview headSHAの承認（同じ確認タイミングでFact Check記録も確認。AIの自己申告だけでは通さない）

## 本番とコスト方針

- 本番の正本は Cloudflare Workers（`https://naru-career.com`）。公開確認はCloudflare deploy成功と実URLの確認で行う。
- 有料APIへのフォールバックは持たない。

## Manifest（round 2 / subround A）

- 日次manifestの置き場所（規約）: `data/editor-agent/run-YYYY-MM-DD.json`（コアはファイルI/Oを行わない）。実運用では本番デプロイを不要に増やさないため専用の `editor-agent/state` ブランチ上で管理し、masterへ日次状態ファイルを直接書かない。候補・selected queueの正本は引き続き `article-factory/candidates` から読む。
- `schemaVersion: 1`。`date`, `candidatesReady`, run `blockers`, slot `1`/`2`（既存 `ArticleSlotFacts`）, 任意の `lastReconciledAt`。
- 評価結果（state等）は保存せず、`manifestToRunFacts()` → `evaluateRun()` で都度導出する。
- `src/lib/naru-editor-agent/manifest.ts`: `createEmptyManifest` / `normalizeManifest` / `parseManifest` / `serializeManifest`（キー順固定・決定論的）/ `reconcileRunManifest(existing, evidence)`。
- reconcile規則: 指定した項目だけ更新（省略・nullで消えない）／candidateId・articleId・slugの衝突はエラー（fail closed）／選択は `selected: true` のみ反映／画像refは枠ごとに独立／blockerは省略で保持、`replaceBlockers` を明示した時だけ置換／QA・CI・承認はSHA紐づけのため、head変更後は評価側で無効。

## CLI

リポジトリ内のmanifestは安全なローカルCLIで読み書きできる。

```bash
npm run editor-agent -- status --date 2026-10-05
npm run editor-agent -- next --date 2026-10-05
npm run editor-agent -- reconcile --date 2026-10-05 --evidence ./evidence.json
```

- `status`: manifestが無くても空runをメモリ上で評価するだけで、ファイルは作らない。
- `next`: 2スロットそれぞれの次の安全なアクションとhuman gateをJSONで返す。
- `reconcile`: ChatGPT/automationが収集した正規化evidenceを既存manifestへ冪等に統合し、`data/editor-agent/run-YYYY-MM-DD.json` を更新する。
- CLIはネットワーク、LLM、有料API、GitHub merge、Cloudflare deployを呼ばない。

### Evidenceの正本

- 候補選択: `article-factory/candidates` の `selected-queue-YYYY-MM-DD.json` とユーザーの明示選択。Editor Agent manifest自体は `editor-agent/state` に保存する。
- GSC / Web / Drive / GitHub / Cloudflareの実状態: ChatGPTが接続済みツールから毎回取得し、evidenceとして渡す。
- Claude Code: 実装ワーカー。編集上の事実やユーザー承認の正本にはしない。
- preview承認: 現在のPR head SHAと完全一致するユーザー承認のみ有効。公開前のFact Checkは一次情報・著者実体験に基づく人間確認を同じhead SHAへ別ゲートとして記録し、AIの自己判定で代替しない。
- 公開完了: mergeだけでは不可。Cloudflare Production成功と実記事URL確認が必要。

## コスト・クォータ方針

OpenAI API、Anthropic APIキー課金、Google Ads Keyword Planner、Semrush/Ahrefs等の有料SEO APIへ自動フォールバックしない。Claude Codeの利用枠・rate limitに達した場合は追加課金へ切り替えず、runをHELD/保留として次回再開する。

## 残るアダプタ

GitHub / Drive / GSC / Web / Cloudflareからevidenceを集め、`editor-agent/state` のmanifestへ冪等に反映するスケジューラ層はChatGPT側の定期タスクで接続する。`article-factory/candidates` は候補・選択の正本、`editor-agent/state` は進行状態の正本として役割を分離する。human gateを迂回する無人publish adapterは作らない。
