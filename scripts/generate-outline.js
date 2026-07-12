/**
 * 骨子生成スクリプト
 *
 * 使い方:
 *   node scripts/generate-outline.js "第二新卒 IT 転職" "体験談"
 *
 * 概要:
 *   キーワードとカテゴリを受け取り、prompts/outline-prompt.mdのテンプレートに
 *   値を埋め込んだプロンプトを標準出力に出力する。
 *   出力されたプロンプトをClaude等のLLMに投げて骨子を生成する想定。
 */

const fs = require("fs");
const path = require("path");

const keyword = process.argv[2];
const category = process.argv[3];

if (!keyword || !category) {
  console.error("Usage: node scripts/generate-outline.js <keyword> <category>");
  console.error('Example: node scripts/generate-outline.js "第二新卒 IT 転職" "体験談"');
  process.exit(1);
}

const templatePath = path.join(__dirname, "..", "prompts", "outline-prompt.md");
const template = fs.readFileSync(templatePath, "utf-8");

const prompt = template
  .replace("{{keyword}}", keyword)
  .replace("{{category}}", category);

console.log(prompt);
