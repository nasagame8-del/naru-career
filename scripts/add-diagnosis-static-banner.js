/**
 * 業界解説・認知系の記事に /diagnosis への静的バナーを追加するスクリプト
 */
const fs = require("fs");
const path = require("path");

const articlesDir = path.join(__dirname, "..", "content", "articles");

const BANNER = `
> **自分に向いている職種が分からない方へ**
> 10問の質問に答えるだけで、あなたに合うIT/Web業界の職種タイプが分かります。
> [適職診断を受けてみる →](/diagnosis)
`;

// 記事ごとの挿入先（このh2の直前に挿入）
const insertMap = {
  "web-industry-guide": "## AIO対策の将来性",
  "what-is-second-new-grad": "## 企業が第二新卒を採用する3つの理由",
  "aio-seo-industry-inside": "## 「営業→マーケティング」の染み出しがキャリアを広げた",
  "second-new-grad-retirement-pay": "## ボーナス支給タイミングと転職",
  "recruitment-agency-business-model": "## 「早期退職の返金規定」があるから雑な紹介はリスクになる",
  "agent-free-and-cancel": "## 断るときの具体的な伝え方",
  "it-industry-quit-myth": "## SES「やめとけ」の不安にどう向き合うか",
  "it-web-industry-real-work-culture": "## IT/Web業界に向いている人・向いていない人",
  "what-is-web-industry": "## Web業界の働き方と将来性",
  "alumni-hiring": "## アルムナイ採用と他の採用手法の違い",
  "referral-hiring": "## リファラル採用と他の採用手法の違い",
  "direct-recruiting": "## ダイレクトリクルーティングと他の採用手法の違い",
  "casual-interview": "## 第二新卒がカジュアル面談を活用すべき3つの理由",
  "skill-based-hiring": "## 第二新卒がスキルベース採用に対応するための実践ステップ",
  "ai-interview-screening": "## AI面接で評価されるポイントと具体的な対策",
};

let count = 0;
for (const [slug, heading] of Object.entries(insertMap)) {
  const filePath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) { console.log(`[SKIP] ${slug}: ファイルなし`); continue; }

  let content = fs.readFileSync(filePath, "utf-8");

  if (content.includes("[適職診断を受けてみる")) {
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
