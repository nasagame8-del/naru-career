/**
 * 下書き生成スクリプト
 *
 * 使い方:
 *   node scripts/generate-draft.js path/to/outline.md
 *
 * 概要:
 *   骨子ファイルを受け取り、prompts/draft-prompt.mdのテンプレートに
 *   骨子内容を埋め込んだプロンプトを標準出力に出力する。
 *   出力されたプロンプトをClaude等のLLMに投げて下書きを生成する想定。
 */

const fs = require("fs");
const path = require("path");

const outlinePath = process.argv[2];

if (!outlinePath) {
  console.error("Usage: node scripts/generate-draft.js <outline-file>");
  console.error("Example: node scripts/generate-draft.js outline.md");
  process.exit(1);
}

const outline = fs.readFileSync(outlinePath, "utf-8");
const templatePath = path.join(__dirname, "..", "prompts", "draft-prompt.md");
const template = fs.readFileSync(templatePath, "utf-8");
const personaPath = path.join(__dirname, "..", "prompts", "persona.md");
const persona = fs.readFileSync(personaPath, "utf-8");

const prompt = template.replace("{{outline}}", outline) + "\n\n---\n\n## 参照: persona.md\n\n" + persona;

console.log(prompt);
