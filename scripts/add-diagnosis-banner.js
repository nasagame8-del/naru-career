/**
 * エージェント相性診断への導線バナーを記事に追加するスクリプト
 */
const fs = require("fs");
const path = require("path");

const articlesDir = path.join(__dirname, "..", "content", "articles");

const BANNER = `
> **自分に合うエージェントが分からない方へ**
> 5つの質問に答えるだけで、あなたに合う転職エージェントが分かります。
> [エージェント相性診断を受けてみる →](/agent-diagnosis)
`;

// 記事ごとの挿入先（直前に挿入するh2見出し）
const insertMap = {
  "second-new-grad-it-career-change": "## 第二新卒のIT転職で使えるエージェント",
  "agent-comparison-2026": "## タイプ別おすすめの選び方",
  "agent-site-vs-agent-usage": "## 「どっちも合わなかった」場合の選択肢",
  "agent-referral-vs-self-apply": "## 両方使う場合の具体的な進め方",
  "bizreach-second-new-grad": "## 第二新卒の転職で本当に使うべきサービスの組み合わせ",
  "second-new-grad-programming-career-change": "## 転職活動で失敗したこと・反省点",
};

let count = 0;
for (const [slug, heading] of Object.entries(insertMap)) {
  const filePath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) { console.log(`[SKIP] ${slug}: ファイルなし`); continue; }

  let content = fs.readFileSync(filePath, "utf-8");

  if (content.includes("/agent-diagnosis")) {
    console.log(`[SKIP] ${slug}: バナー既存`);
    continue;
  }

  const idx = content.indexOf(`\n${heading}`);
  if (idx === -1) {
    console.log(`[WARN] ${slug}: 見出し "${heading}" が見つかりません`);
    continue;
  }

  content = content.slice(0, idx) + "\n" + BANNER + content.slice(idx);
  fs.writeFileSync(filePath, content);
  console.log(`[OK] ${slug}`);
  count++;
}

console.log(`\n[完了] ${count}記事にバナーを追加`);
