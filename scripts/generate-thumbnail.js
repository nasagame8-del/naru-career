/**
 * サムネイル生成スクリプト
 *
 * 記事タイトルに基づいてOpenAI Images APIでイラスト系サムネイルを生成する。
 * 1枚をcard・og両方で共用する。
 *
 * 使い方:
 *   node scripts/generate-thumbnail.js <slug>
 *   node scripts/generate-thumbnail.js --batch
 *   node scripts/generate-thumbnail.js --batch --force
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const sharp = require("sharp");
const OpenAI = require("openai").default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const articlesDir = path.join(__dirname, "..", "content", "articles");
const outputDir = path.join(__dirname, "..", "public", "images", "articles");

const WIDTH = 1200;
const HEIGHT = 630;

// ---------------------------------------------------------------------------
// プロンプト生成
// ---------------------------------------------------------------------------

function buildPrompt(title) {
  return `横長のワイド構図（アスペクト比 約2:1）で、オウンドメディアの記事サムネイルを作ってほしい。タイトルは「${title}」です。

【レイアウト厳守 — 最重要】
- この画像は横長の枠（2:1）に表示される。上下が少しでもクロップされると要素が消えるため、以下を厳守すること
- すべての重要な要素（人物、タイトル文字、アイコン）は、画像の上下中央30%の帯（上端35%〜下端65%）に集中させること
- 画像の上端20%と下端20%は「安全マージン」として、背景色のみ・装飾なしの空白にすること
- 人物を描く場合は胸から上のバストショットにし、頭頂部の上に画像高さの20%以上の余白を確保すること
- テキストは画像の垂直中央に配置し、上端・下端に近づけないこと
- 左右にも10%以上の余白を確保すること

【デザイン】
- 情報量を少なくして、わかりやすくする
- メインカラーはアンバー(#B5691B)とティーングリーン(#1F6F66)
- 実在する企業のロゴ・商標・ブランドマークは一切描かない
- 社名を画像内に文字として含めない
- サービス名を示す場合は一般的な言葉(例:「エージェントA」)で表現する`;
}

// ---------------------------------------------------------------------------
// 1記事分の生成
// ---------------------------------------------------------------------------

async function generateThumbnail(slug) {
  const mdPath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(mdPath)) {
    console.error(`[ERROR] 記事が見つかりません: ${slug}`);
    return false;
  }

  const file = fs.readFileSync(mdPath, "utf-8");
  const { data } = matter(file);
  const title = data.title || slug;
  const prompt = buildPrompt(title);

  console.log(`[INFO] 生成中: ${slug}`);
  console.log(`  タイトル: 「${title}」`);

  try {
    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const rawBuffer = Buffer.from(result.data[0].b64_json, "base64");

    // 1536x1024 (3:2) → 1200x630 (1.91:1) 変換
    // fit: "cover" だと上下がクロップされるため、
    // まず中央から1.91:1の領域を切り出してからリサイズする
    const meta = await sharp(rawBuffer).metadata();
    const srcW = meta.width;
    const srcH = meta.height;
    const targetRatio = WIDTH / HEIGHT; // 1.9047...
    const srcRatio = srcW / srcH;

    let extractLeft = 0, extractTop = 0, extractW = srcW, extractH = srcH;
    if (srcRatio < targetRatio) {
      // 元画像が目標より縦長 → 上下を切る（中央基準）
      extractH = Math.round(srcW / targetRatio);
      extractTop = Math.round((srcH - extractH) / 2);
      extractW = srcW;
    } else {
      // 元画像が目標より横長 → 左右を切る（中央基準）
      extractW = Math.round(srcH * targetRatio);
      extractLeft = Math.round((srcW - extractW) / 2);
      extractH = srcH;
    }

    const resized = await sharp(rawBuffer)
      .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
      .resize(WIDTH, HEIGHT)
      .png()
      .toBuffer();

    const outputPath = path.join(outputDir, `${slug}-card.png`);
    fs.writeFileSync(outputPath, resized);

    console.log(`[OK] 保存完了: images/articles/${slug}-card.png`);
    return true;
  } catch (err) {
    console.error(`[ERROR] ${slug}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// バッチモード
// ---------------------------------------------------------------------------

async function batchGenerate(force) {
  const files = fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"));
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const cardPath = path.join(outputDir, `${slug}-card.png`);

    if (!force && fs.existsSync(cardPath)) {
      console.log(`[SKIP] 既に存在: ${slug}`);
      skipped++;
      continue;
    }

    const ok = await generateThumbnail(slug);
    if (ok) generated++;
    else failed++;

    // レートリミット対策
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(
    `\n[完了] 生成: ${generated}, スキップ: ${skipped}, 失敗: ${failed}`
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[ERROR] OPENAI_API_KEY が設定されていません (.env.local を確認)");
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slug = args.find((a) => a !== "--batch" && a !== "--force");

  if (args.length === 0) {
    console.log("使い方:");
    console.log("  node scripts/generate-thumbnail.js <slug>");
    console.log("  node scripts/generate-thumbnail.js --batch");
    console.log("  node scripts/generate-thumbnail.js --batch --force");
    process.exit(0);
  }

  if (args.includes("--batch")) {
    await batchGenerate(force);
  } else if (slug) {
    await generateThumbnail(slug);
  }
}

main();
