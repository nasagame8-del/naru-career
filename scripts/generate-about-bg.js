/**
 * aboutページ実績セクションの背景画像を生成するスクリプト
 *
 * 使い方:
 *   node scripts/generate-about-bg.js
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const OpenAI = require("openai").default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WIDTH = 2400;
const HEIGHT = 800;

const prompt = `オウンドメディアの著者ページに使う、統計・実績セクションの背景画像を作ってください。完全に抽象的なフラットデザイン。文字・数字・アイコン・人物は一切含めない。メインカラーはアンバー(#B5691B)を基調とし、ティーングリーン(#1F6F66)を控えめに差し色として使う。ロゴのモチーフ(紙が角から折れ曲がる抽象図形)を薄く大きく引き伸ばしたような、控えめな地紋・テクスチャとして背景に敷く。グラデーション・光沢・3D的な質感は使わない、完全なフラットカラー。サイズは横長(2400x800px程度、3:1比率)。`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[ERROR] OPENAI_API_KEY が設定されていません");
    process.exit(1);
  }

  console.log("[INFO] 背景画像を生成中...");

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

  const outputPath = path.join(
    __dirname,
    "..",
    "public",
    "images",
    "about-stats-bg.png"
  );
  fs.writeFileSync(outputPath, resized);

  console.log(`[OK] 保存完了: public/images/about-stats-bg.png`);
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
});
