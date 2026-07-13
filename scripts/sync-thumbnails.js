/**
 * サムネイル同期スクリプト
 *
 * content/articles/ 内の全記事を走査し、サムネイルが未生成の記事があれば
 * 自動で生成する。git pull 後やCI/CDパイプラインで実行する想定。
 *
 * 使い方:
 *   node scripts/sync-thumbnails.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const articlesDir = path.join(__dirname, "..", "content", "articles");
const imagesDir = path.join(__dirname, "..", "public", "images", "articles");

function getMissingSlugs() {
  const files = fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"));

  return files
    .map((f) => f.replace(/\.md$/, ""))
    .filter((slug) => !fs.existsSync(path.join(imagesDir, `${slug}-card.png`)));
}

async function main() {
  const missing = getMissingSlugs();

  if (missing.length === 0) {
    console.log("[sync-thumbnails] 全記事のサムネイルが揃っています");
    return;
  }

  console.log(`[sync-thumbnails] ${missing.length}件の未生成サムネイルを検出:`);
  missing.forEach((s) => console.log(`  - ${s}`));

  // generate-thumbnail.js の batchGenerate に委譲
  const { execSync } = require("child_process");
  for (const slug of missing) {
    console.log(`\n[sync-thumbnails] 生成中: ${slug}`);
    try {
      execSync(`node scripts/generate-thumbnail.js ${slug}`, {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        timeout: 60000,
      });
    } catch (e) {
      console.error(`[sync-thumbnails] 失敗: ${slug}`);
    }
  }

  console.log("\n[sync-thumbnails] 完了");
}

main();
