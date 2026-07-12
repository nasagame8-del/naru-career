/**
 * CTAボタン展開スクリプト
 *
 * 使い方:
 *   node scripts/insert-cta.js content/articles/example.md
 *
 * 概要:
 *   記事本文中の [CTA_BUTTON:key] プレースホルダーを
 *   cta-registry.json の情報に基づいてHTMLに変換する。
 *   ※ 実際のレンダリングはNext.js側(lib/articles.ts)で行うため、
 *   このスクリプトはプレビュー・検証用途。
 */

const fs = require("fs");
const path = require("path");

const articlePath = process.argv[2];

if (!articlePath) {
  console.error("Usage: node scripts/insert-cta.js <article-file>");
  process.exit(1);
}

const registryPath = path.join(__dirname, "..", "data", "cta-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

const content = fs.readFileSync(articlePath, "utf-8");

const result = content.replace(/\[CTA_BUTTON:(\w+)\]/g, (match, key) => {
  const cta = registry[key];
  if (!cta) {
    console.warn(`Warning: CTA key "${key}" not found in registry`);
    return match;
  }
  if (!cta.url) {
    console.warn(`Warning: CTA "${key}" has no URL set yet`);
  }
  return `<a href="${cta.url || "#"}" class="cta-button" rel="nofollow sponsored" target="_blank">${cta.cta_text}（${cta.name}）</a>`;
});

console.log(result);
