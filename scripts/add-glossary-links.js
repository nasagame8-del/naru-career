/**
 * 記事本文中の専門用語の初出箇所に用語集リンクを追加するスクリプト
 *
 * 形式: 「第二新卒」→ 「[第二新卒](/glossary)」
 * 各記事で各用語は1回だけリンク化（初出のみ）
 */
const fs = require("fs");
const path = require("path");

const articlesDir = path.join(__dirname, "..", "content", "articles");

// 用語とリンク先のマッピング（用語集に掲載済みの用語のみ）
const glossaryTerms = [
  { pattern: "第二新卒", anchor: "/glossary" },
  { pattern: "ポテンシャル採用", anchor: "/glossary" },
  { pattern: "リファラル採用", anchor: "/glossary" },
  { pattern: "ジョブ型雇用", anchor: "/glossary" },
  { pattern: "非公開求人", anchor: "/glossary" },
  { pattern: "SES", anchor: "/glossary" },
  { pattern: "SIer", anchor: "/glossary" },
  { pattern: "カスタマーサクセス", anchor: "/glossary" },
  { pattern: "スカウト型", anchor: "/glossary" },
  { pattern: "アルムナイ採用", anchor: "/glossary" },
  { pattern: "ダイレクトリクルーティング", anchor: "/glossary" },
  { pattern: "カジュアル面談", anchor: "/glossary" },
  { pattern: "スキルベース採用", anchor: "/glossary" },
  { pattern: "AI面接", anchor: "/glossary" },
];

// 用語集自体の専門記事はリンク不要（自己参照になるため）
const skipMap = {
  "what-is-second-new-grad": ["第二新卒"],
  "referral-hiring": ["リファラル採用"],
  "alumni-hiring": ["アルムナイ採用"],
  "direct-recruiting": ["ダイレクトリクルーティング", "スカウト型"],
  "casual-interview": ["カジュアル面談"],
  "skill-based-hiring": ["スキルベース採用"],
  "ai-interview-screening": ["AI面接"],
};

function addGlossaryLinks(slug) {
  const filePath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return 0;

  let content = fs.readFileSync(filePath, "utf-8");

  // frontmatterを分離
  const parts = content.split("---");
  if (parts.length < 3) return 0;
  const frontmatter = "---" + parts[1] + "---";
  let body = parts.slice(2).join("---");

  const skipTerms = skipMap[slug] || [];
  let addedCount = 0;

  for (const term of glossaryTerms) {
    if (skipTerms.includes(term.pattern)) continue;

    // 既にリンク化されている場合はスキップ
    if (body.includes(`[${term.pattern}](`)) continue;
    // リンク内のテキストとして含まれている場合はスキップ
    if (body.includes(`](${term.anchor})`)) continue;

    // 本文中の初出のみリンク化（見出し行は除外）
    const regex = new RegExp(`(?<!\\[)(?<!#+ .*)${term.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\])(?!.*\\))`, "m");
    if (regex.test(body)) {
      body = body.replace(regex, `[${term.pattern}](${term.anchor})`);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    fs.writeFileSync(filePath, frontmatter + body);
  }
  return addedCount;
}

let totalLinks = 0;
let articlesModified = 0;
const files = fs.readdirSync(articlesDir)
  .filter(f => f.endsWith(".md") && !f.endsWith("-note.md"));

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const count = addGlossaryLinks(slug);
  if (count > 0) {
    console.log(`[OK] ${slug}: ${count}用語をリンク化`);
    totalLinks += count;
    articlesModified++;
  }
}

console.log(`\n[完了] ${articlesModified}記事で合計${totalLinks}用語をリンク化`);
