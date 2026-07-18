/**
 * note版記事用の見出し画像を生成するスクリプト
 *
 * generate-thumbnail.js のロジックを流用。
 * サイズ: 1280x670px (1.91:1に近い比率)
 * 保存先: /content/note-drafts-images/{slug}-note-header.png
 *
 * 使い方:
 *   node scripts/generate-note-header.js <slug>
 *   node scripts/generate-note-header.js --batch
 *   node scripts/generate-note-header.js --batch --force
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const sharp = require("sharp");
const OpenAI = require("openai").default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const noteDraftsDir = path.join(__dirname, "..", "content", "note-drafts");
const outputDir = path.join(__dirname, "..", "content", "note-drafts-images");

const WIDTH = 1280;
const HEIGHT = 670;

function buildPrompt(title) {
  return `横長のワイド構図（アスペクト比 約1.91:1）で、noteの記事見出し画像を作ってほしい。記事タイトルは「${title}」です。

【最重要ルール】
- この画像はnoteの見出し画像として使用する。文字・数字・テキスト・ラベルは一切含めないこと
- タイトル文字、見出し、キャプション、ロゴ文字など、あらゆるテキスト要素を描かないこと

【レイアウト】
- すべての視覚要素（人物、オブジェクト、装飾）は画像の中央帯（上端30%〜下端70%）に収めること
- 上端20%と下端20%は背景色のみの余白にすること

【デザイン】
- シンプルで落ち着いた雰囲気のイラスト
- メインカラーはアンバー(#B5691B)とティーングリーン(#1F6F66)
- テーマに関連するイラスト・シンボルで内容を視覚的に表現する
- 実在する企業のロゴ・商標は一切描かない`;
}

async function generateHeader(slug) {
  const mdPath = path.join(noteDraftsDir, `${slug}-note.md`);
  if (!fs.existsSync(mdPath)) {
    console.error(`[ERROR] note記事が見つかりません: ${slug}`);
    return false;
  }

  const file = fs.readFileSync(mdPath, "utf-8");
  const { data } = matter(file);
  const title = data.title || slug;

  if (!title || title === slug) {
    console.log(`[SKIP] ${slug}: タイトルなし`);
    return false;
  }

  console.log(`[INFO] 生成中: ${slug}`);
  console.log(`  タイトル: 「${title}」`);

  try {
    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt: buildPrompt(title),
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const rawBuffer = Buffer.from(result.data[0].b64_json, "base64");

    // 1536x1024 (3:2) → 1280x670 (1.91:1) 中央クロップ
    const meta = await sharp(rawBuffer).metadata();
    const srcW = meta.width;
    const srcH = meta.height;
    const targetRatio = WIDTH / HEIGHT;
    const extractH = Math.round(srcW / targetRatio);
    const extractTop = Math.round((srcH - extractH) / 2);

    const resized = await sharp(rawBuffer)
      .extract({ left: 0, top: extractTop, width: srcW, height: extractH })
      .resize(WIDTH, HEIGHT)
      .png()
      .toBuffer();

    const outputPath = path.join(outputDir, `${slug}-note-header.png`);
    fs.writeFileSync(outputPath, resized);

    console.log(`[OK] 保存完了: ${slug}-note-header.png`);
    return true;
  } catch (err) {
    console.error(`[ERROR] ${slug}: ${err.message}`);
    return false;
  }
}

async function batchGenerate(force) {
  const files = fs
    .readdirSync(noteDraftsDir)
    .filter((f) => f.endsWith("-note.md"));
  let generated = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const slug = file.replace(/-note\.md$/, "");
    const headerPath = path.join(outputDir, `${slug}-note-header.png`);

    if (!force && fs.existsSync(headerPath)) {
      console.log(`[SKIP] 既に存在: ${slug}`);
      skipped++;
      continue;
    }

    const ok = await generateHeader(slug);
    if (ok) generated++;
    else { skipped++; }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n[完了] 生成: ${generated}, スキップ: ${skipped}, 失敗: ${failed}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[ERROR] OPENAI_API_KEY が設定されていません");
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
    console.log("  node scripts/generate-note-header.js <slug>");
    console.log("  node scripts/generate-note-header.js --batch");
    console.log("  node scripts/generate-note-header.js --batch --force");
    process.exit(0);
  }

  if (args.includes("--batch")) {
    await batchGenerate(force);
  } else if (slug) {
    await generateHeader(slug);
  }
}

main();
