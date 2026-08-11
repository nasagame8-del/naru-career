/**
 * IndexNow通知スクリプト
 *
 * 使い方:
 *   # 特定のURLを通知
 *   node scripts/notify-indexnow.js /articles/what-is-second-new-grad
 *
 *   # 複数URLを通知
 *   node scripts/notify-indexnow.js /articles/slug1 /articles/slug2
 *
 *   # 全記事を通知（--all）
 *   node scripts/notify-indexnow.js --all
 *
 *   # 直近N日以内に更新された記事のみ通知（--recent N）
 *   node scripts/notify-indexnow.js --recent 3
 *
 * 環境変数:
 *   INDEXNOW_SECRET  - APIルートの認証シークレット（.env.localに設定）
 *   NEXT_PUBLIC_BASE_URL - サイトのベースURL（デフォルト: https://naru-career.com）
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
const SECRET = process.env.INDEXNOW_SECRET;

if (!SECRET) {
  console.error("[ERROR] INDEXNOW_SECRET が .env.local に設定されていません");
  process.exit(1);
}

async function notify(urls) {
  console.log(`[IndexNow] ${urls.length}件のURLを通知します...`);
  urls.forEach((u) => console.log(`  ${u}`));

  const res = await fetch(`${SITE_URL}/api/indexnow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-indexnow-secret": SECRET,
    },
    body: JSON.stringify({ urls }),
  });

  const data = await res.json();
  if (data.success) {
    console.log(`[OK] IndexNow通知成功 (status: ${data.indexnowStatus})`);
  } else {
    console.error(`[ERROR] IndexNow通知失敗:`, data);
  }
}

function getAllArticleUrls() {
  const dir = path.join(__dirname, "..", "content", "articles");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .map((f) => `/articles/${f.replace(/\.md$/, "")}`);
}

function getRecentArticleUrls(days) {
  const dir = path.join(__dirname, "..", "content", "articles");
  if (!fs.existsSync(dir)) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .filter((f) => {
      const content = fs.readFileSync(path.join(dir, f), "utf-8");
      const { data } = matter(content);
      const modified = new Date(data.dateModified || data.datePublished || "");
      return modified >= cutoff;
    })
    .map((f) => `/articles/${f.replace(/\.md$/, "")}`);
}

async function main() {
  const args = process.argv.slice(2);

  let urls;
  if (args.includes("--all")) {
    urls = getAllArticleUrls();
    // Also include static pages
    urls.push("/", "/about", "/shindan", "/glossary");
  } else if (args.includes("--recent")) {
    const daysIdx = args.indexOf("--recent") + 1;
    const days = parseInt(args[daysIdx]) || 3;
    urls = getRecentArticleUrls(days);
  } else if (args.length > 0) {
    urls = args.filter((a) => !a.startsWith("--"));
  } else {
    console.log("使い方:");
    console.log("  node scripts/notify-indexnow.js /articles/slug");
    console.log("  node scripts/notify-indexnow.js --all");
    console.log("  node scripts/notify-indexnow.js --recent 3");
    process.exit(0);
  }

  if (urls.length === 0) {
    console.log("[INFO] 通知対象のURLがありません");
    return;
  }

  // IndexNow batch limit: 10,000 URLs per request
  const BATCH_SIZE = 100;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    await notify(urls.slice(i, i + BATCH_SIZE));
  }
}

main().catch((e) => {
  console.error("[ERROR]", e.message);
  process.exit(1);
});
