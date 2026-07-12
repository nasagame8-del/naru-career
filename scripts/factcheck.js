/**
 * ファクトチェックプロンプト生成スクリプト
 *
 * 使い方:
 *   node scripts/factcheck.js content/articles/example.md
 *
 * 概要:
 *   記事ファイルを受け取り、prompts/factcheck-prompt.mdのテンプレートに
 *   記事内容を埋め込んだプロンプトを標準出力に出力する。
 *   出力されたプロンプトをClaude等のLLMに投げてファクトチェックを行う想定。
 */

const fs = require("fs");
const path = require("path");

const articlePath = process.argv[2];

if (!articlePath) {
  console.error("Usage: node scripts/factcheck.js <article-file>");
  process.exit(1);
}

const article = fs.readFileSync(articlePath, "utf-8");
const templatePath = path.join(__dirname, "..", "prompts", "factcheck-prompt.md");
const template = fs.readFileSync(templatePath, "utf-8");

const prompt = template.replace("{{article_content}}", article);

console.log(prompt);
