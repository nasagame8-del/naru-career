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

主なルール: 選択は推測しない／画像は card・01・02・03 の4枚必須／QA・CIは最新headSHAに対する結果のみ有効／
`previewApprovedHeadSha === latestHeadSha` のときだけ承認有効／`SCHEDULED` は明示的な `requestedPublishAt` が必要／
`PUBLISHED` は mergeSha + 本番デプロイ確認 + 公開URL + 公開URL確認が揃うまで成立しない（mergeだけでは `PUBLISHING`）。

## 人間のゲート（3つ）

1. 記事2本の選択
2. 記事ごとの画像4枚の提供
3. 正確なpreview headSHAの承認

## 本番とコスト方針

- 本番の正本は Cloudflare Workers（`https://naru-career.com`）。公開確認はCloudflare deploy成功と実URLの確認で行う。
- 有料APIへのフォールバックは持たない。

## 次ラウンド（round 2）

リポジトリmanifest、CLI、各種アダプタ（GitHub / Drive / Cloudflare）を追加する。
