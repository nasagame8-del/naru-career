# ValueCommerce素材・掲載先 2026-11-08

SID 3775939。ユーザー提供コードを正本として保持。JSバナーはdocument.writeを含むため独立iframeのsrcDocで実行し、noscriptを削除しない。画像URLへの置換やサイズ変更は行わない。テキスト広告は提供文字列と1×1計測画像を保持。

## 素材の現物確認

|PID|サービス|寸法/種別|使用|
|---|---|---|---|
|892743441|TechClips|300×250|PC横枠|
|892743442|TechClips|468×60|登録のみ|
|892743443|TechClips|テキスト|横枠の下|
|892743444|Geekly|468×60|登録のみ|
|892743445|Geekly|160×600|登録のみ|
|892743446|Geekly|250×250|PC横枠・SP末尾|
|892743447|ASSIGN|テキスト|バナーの下|
|892743448|ASSIGN|300×300|PC横枠・SP末尾|
|892743449|リクルートエージェント|728×90|登録のみ|
|892743450|リクルートエージェント|300×250|PC横枠・SP本文/末尾|

## 記事別

|slug|サービス|変更|SP|
|---|---|---|---|
|ses-explained|TechClips|横枠追加|既存本文CTAあり・末尾追加なし|
|it-industry-quit-myth|Geekly|UZUZ枠置換|末尾|
|second-new-grad-web-agency-vs-inhouse|Geekly|UZUZ枠置換|末尾|
|second-career-change-job-selection-axis|ASSIGN|枠追加|末尾|
|vaguely-want-to-quit|ASSIGN|UZUZ枠置換|末尾|
|promotion-blocked-by-boss|ASSIGN|横枠追加|既存本文広告あり・末尾追加なし|
|unfair-evaluation-not-spoiled|リクルートエージェント|横枠追加|既存本文広告あり・末尾追加なし|
|employee-contractor-pay-comparison|リクルートエージェント|UZUZ枠置換|既存本文位置・紹介文を一致|
|job-change-timing-3months|リクルートエージェント|UZUZ枠置換|末尾|
|winter-bonus-job-change-timing|リクルートエージェント|UZUZ枠置換|末尾|

TechClips/Geeklyの紹介文は経験を活かす読者に限定。ASSIGNは若手ハイエンド向けと明記。既存記事の本文・体験談・旧CTAは変更しない。本人の利用体験として推奨しない。

## 確認資料

- https://help.valuecommerce.ne.jp/aff/ad/adlink/09/ — コード改変禁止と許容範囲。提供コード本体の変更/一部抜粋はしない。
- https://help.valuecommerce.ne.jp/aff/ad/adlink/06/ — JavaScript非対応では専用タグが必要。noscriptのみへの独自置換はしない。
- https://agent.tech-clips.com/ — ITエンジニア、SIer/SESから事業会社等への転職。
- https://www.geekly.co.jp/ — IT/Web/ゲーム領域の転職。
- https://assign-inc.com/company/ — 若手ハイエンド向け転職サイト。

iframeは固定原寸・遅延読込。4サービス以外の既存バナー表示/計測は保持。iframeクリックは親documentのGA4 listenerでは取得されないため、GA4測定済みとしない。新テキストリンクも既存CTAのイベントとしては未計測。ASPのレポートを確認する。

CI/Cloudflare previewとユーザー目視承認待ち。未マージ・未公開。
