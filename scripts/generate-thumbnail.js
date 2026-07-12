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
  return `1.91対1の比率で、オウンドメディアの記事のサムネイルを作ってほしい。タイトルは「${title}」です。情報量を少なくして、わかりやすくしてください。メインカラーはアンバー(#B5691B)とティーングリーン(#1F6F66)を使ってください。実在する企業のロゴ・商標・ブランドマークは一切描かないでください。社名を画像内に文字として含めないでください。サービス名を示したい場合は、社名ではなく一般的な言葉(例:「エージェントA」「エージェントB」)で表現してください。`;
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

    const resized = await sharp(rawBuffer)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
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
