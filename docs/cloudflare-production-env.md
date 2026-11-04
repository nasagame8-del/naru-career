# Cloudflare production environment checklist

NARU の Vercel → Cloudflare Workers 移行用メモ。

## 1. GitHub Actions secrets（Cloudflareへのデプロイ認証）

GitHub Repository Settings → Secrets and variables → Actions に設定する。

- `CLOUDFLARE_API_TOKEN` — Cloudflare Workers 編集権限を持つAPI Token
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID

## 2. Cloudflare Worker Variables / Secrets

Cloudflare Dashboard → Workers & Pages → `naru-career` → Settings → Variables and Secrets。

### 公開サイト・分析

- `NEXT_PUBLIC_BASE_URL=https://naru-career.com`
- `NEXT_PUBLIC_GTM_ID`
- `NEXT_PUBLIC_CLARITY_ID`
- `CONTACT_EMAIL`
- `CONTACT_FROM`
- `RESEND_API_KEY` (Secret)

### 内部ダッシュボード / 記事制作

- `DASHBOARD_USER` (Secret)
- `DASHBOARD_PASSWORD` (Secret)
- `SEO_EDITOR_GITHUB_TOKEN` (Secret)
- `SEO_EDITOR_GITHUB_REPO=nasagame8-del/naru-career`
- `SEO_EDITOR_BASE_BRANCH=master`
- `OPENAI_API_KEY` (Secret)
- `SEO_EDITOR_MODEL`
- `SEO_EDITOR_MODEL_LIGHT`
- `OPENAI_PROOFREAD_MODEL`
- `ARTICLE_FACTORY_MODEL`
- `ARTICLE_FACTORY_MODEL_LIGHT`
- `ARTICLE_FACTORY_MODEL_RESEARCH`
- `ARTICLE_FACTORY_BATCH_STORE=github`
- `ARTICLE_FACTORY_AUTO_PUBLISH`
- `CRON_SECRET` (Secret)

### GSC / GA4

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Secret)
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Secret)
- `SEARCH_CONSOLE_SITE_URL`
- `GA4_PROPERTY_ID`
- `SEO_EDITOR_GSC_CACHE_TTL_MS`

### IndexNow

- `INDEXNOW_KEY`
- `INDEXNOW_SECRET` (Secret)

### Slack / War Room

- `SLACK_CHATGPT_BOT_TOKEN` (Secret)
- `SLACK_SIGNING_SECRET` (Secret)
- `SLACK_WAR_ROOM_CHANNEL_ID`
- `SLACK_CHATGPT_BOT_USER_ID`
- `WAR_ROOM_GITHUB_TOKEN` (Secret)
- `WAR_ROOM_GITHUB_REPO`
- `WAR_ROOM_OPENAI_MODEL`
- `WAR_ROOM_GOOGLE_CREDENTIALS` (Secret; JSON credentials を使う場合)
- `WAR_ROOM_GOOGLE_CLIENT_ID` (Secret; OAuthを使う場合)
- `WAR_ROOM_GOOGLE_CLIENT_SECRET` (Secret; OAuthを使う場合)
- `WAR_ROOM_GOOGLE_REFRESH_TOKEN` (Secret; OAuthを使う場合)
- `WAR_ROOM_GCP_PROJECT_NUMBER`
- `WAR_ROOM_GCP_POOL_ID`
- `WAR_ROOM_GCP_PROVIDER_ID`
- `WAR_ROOM_GCP_SERVICE_ACCOUNT_EMAIL`

### Members

- `MEMBERS_USER`
- `MEMBERS_PASSWORD` (Secret)

### Author

- `AUTHOR_BIRTHDATE`

## 3. Cutover前チェック

- TOP / About / 記事一覧 / 記事詳細 が 200
- `/robots.txt` が 200
- `/sitemap.xml` が 200
- canonical が `https://naru-career.com`
- OGP / 構造化データ / 画像が正常
- `/internal/dashboard` が認証付きで開く
- Contact送信
- IndexNow
- GSC / GA4取得
- Slack webhook/event
- 記事候補生成・GitHub永続化
- `master` push で Cloudflare deploy が成功

DNS / custom domain は上記完了後に切り替える。
