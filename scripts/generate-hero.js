/**
 * 記事詳細ページ用アイキャッチ(hero)画像を生成するスクリプト
 *
 * card/og画像と同じテーマだが、タイトル文字を含まない背景画像を生成する。
 * サイズ: 1600x600 (約2.67:1)
 *
 * 使い方:
 *   node scripts/generate-hero.js <slug>
 *   node scripts/generate-hero.js --batch
 *   node scripts/generate-hero.js --batch --force
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

const WIDTH = 1600;
const HEIGHT = 600;

function buildHeroPrompt(title) {
  return `横長のワイド構図（アスペクト比 約2.67:1、非常に横長）で、オウンドメディアの記事アイキャッチ用の背景画像を作ってほしい。記事のテーマは「${title}」です。

【最重要ルール】
- この画像は背景としてのみ使用する。文字・数字・テキスト・ラベルは一切含めないこと
- タイトル文字、見出し、キャプション、ロゴ文字など、あらゆるテキスト要素を描かないこと

【レイアウト】
- すべての視覚要素（人物、オブジェクト、装飾）は画像の中央帯（上端30%〜下端70%）に収めること
- 上端20%と下端20%は背景色のみの余白にすること
- 人物を描く場合は胸から上のバストショットにし、十分な上下余白を確保すること

【デザイン】
- 情報量を少なくして、シンプルで落ち着いた雰囲気にする
- メインカラーはアンバー(#B5691B)とティーングリーン(#1F6F66)
- テーマに関連するイラスト・アイコン・シンボルで内容を視覚的に表現する
- 実在する企業のロゴ・商標・ブランドマークは一切描かない`;
}

async function generateHero(slug) {
  const mdPath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(mdPath)) {
    console.error(`[ERROR] 記事が見つかりません: ${slug}`);
    return false;
  }

  const file = fs.readFileSync(mdPath, "utf-8");
  const { data } = matter(file);
  const title = data.title || slug;
  const prompt = buildHeroPrompt(title);

  console.log(`[INFO] hero画像を生成中: ${slug}`);
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

    // 1536x1024 (3:2) → 1600x600 (2.67:1) 中央クロップ
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

    const outputPath = path.join(outputDir, `${slug}-hero.png`);
    fs.writeFileSync(outputPath, resized);

    console.log(`[OK] 保存完了: images/articles/${slug}-hero.png`);
    return true;
  } catch (err) {
    console.error(`[ERROR] ${slug}: ${err.message}`);
    return false;
  }
}

async function batchGenerate(force) {
  const files = fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"));
  let generated = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const heroPath = path.join(outputDir, `${slug}-hero.png`);

    if (!force && fs.existsSync(heroPath)) {
      console.log(`[SKIP] 既に存在: ${slug}`);
      skipped++;
      continue;
    }

    const ok = await generateHero(slug);
    if (ok) generated++;
    else failed++;

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
    console.log("  node scripts/generate-hero.js <slug>");
    console.log("  node scripts/generate-hero.js --batch");
    console.log("  node scripts/generate-hero.js --batch --force");
    process.exit(0);
  }

  if (args.includes("--batch")) {
    await batchGenerate(force);
  } else if (slug) {
    await generateHero(slug);
  }
}

main();
