/**
 * 背景素材ストック生成スクリプト
 *
 * カテゴリごとに文字なしの背景画像を2〜3パターン生成し、
 * /public/images/backgrounds/ に保存する。
 *
 * 使い方:
 *   node scripts/generate-backgrounds.js           # 全カテゴリ生成
 *   node scripts/generate-backgrounds.js 体験談     # 特定カテゴリのみ
 *   node scripts/generate-backgrounds.js --force    # 既存を上書き再生成
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;
const sharp = require("sharp");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const outputDir = path.join(__dirname, "..", "public", "images", "backgrounds");

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 630;

// ---------------------------------------------------------------------------
// 共通の厳守事項
// ---------------------------------------------------------------------------

const STRICT_RULES = `厳守事項:
- 完全にフラットなベタ塗り。グラデーション・影・光沢は一切使わない
- 文字・ロゴ・人物・写実的なオブジェクトは含めない
- 成長矢印・グラフ・丸(太陽/コイン)のモチーフは使わない
- 背景に枠(角丸スクエア等)を作らない、画面全体が単色背景
サイズ: 1200x630px(横長)`;

// ---------------------------------------------------------------------------
// カテゴリ別テンプレート
// ---------------------------------------------------------------------------

const TEMPLATES = {
  体験談: [
    {
      id: "taiken-1",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のアンバー(#B5691B)
モチーフ: 画面の一部が紙のように折れ曲がり、裏面(白または薄いクリーム色)が見えている抽象的な図形。折り目は1本のはっきりした直線またはカーブ。
折れた部分の配置・角度: 右上の角が折れる
${STRICT_RULES}`,
    },
    {
      id: "taiken-2",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のアンバー(#B5691B)
モチーフ: 画面中央やや上寄りに、縦長の四角い紙(A4用紙のような縦横比の白い長方形)が1枚置かれている。紙の左下の角だけが三角形に折れ曲がり、折れた部分の裏面が薄いクリーム色で見えている。紙の他の3つの角は直角のまま。紙全体のシルエットは明確に「四角い書類」と分かる形状を保つこと。
厳守: 紙を葉・炎・旗・リボンのような有機的な形状に変えない。折り目は直線。紙の裏面は必ず薄いクリーム色で見えること。
${STRICT_RULES}`,
    },
    {
      id: "taiken-3",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のアンバー(#B5691B)
モチーフ: 画面中央やや上寄りに、縦長の四角い紙(A4用紙のような縦横比の白い長方形)が1枚置かれている。紙の中央付近から斜め方向に1本の直線的な折り目が入り、紙の下半分が大きく折れ曲がって裏面(薄いクリーム色)が見えている。紙全体の外形は矩形のシルエットを維持し、四角い書類であることが一目で分かること。
厳守: 紙を葉・炎・旗・リボンのような有機的な形状に変えない。折り目は直線。折れた先端を尖らせすぎて矢印状にしない。紙の裏面は必ず薄いクリーム色で見えること。
${STRICT_RULES}`,
    },
  ],
  エージェント比較: [
    {
      id: "agent-1",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のティーングリーン(#1F6F66)
モチーフ: 均一な太さの2本の帯状の図形が、1点から2方向に伸びている。1本はアンバー(#B5691B)、もう1本は背景よりわずかに暗いティーンで塗る。帯の両端は直角に断ち切られた形状(矢印や三角形の先端は絶対に付けない)。帯は道路や川のような抽象的なパスとして描く。
配置: 左寄りの1点から右方向に分岐
重要: 帯の端は四角く断ち切る。矢印・矢じり・三角形・ポインターの形状は絶対に描かない。
${STRICT_RULES}`,
    },
    {
      id: "agent-2",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のティーングリーン(#1F6F66)
モチーフ: 均一な太さの2本の帯状の図形が、1点から2方向に伸びている。1本はアンバー(#B5691B)、もう1本は背景よりわずかに暗いティーンで塗る。帯の両端は直角に断ち切られた形状(矢印や三角形の先端は絶対に付けない)。帯は道路や川のような抽象的なパスとして描く。
配置: 画面中央の1点から上下に分岐
重要: 帯の端は四角く断ち切る。矢印・矢じり・三角形・ポインターの形状は絶対に描かない。
${STRICT_RULES}`,
    },
    {
      id: "agent-3",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のティーングリーン(#1F6F66)
モチーフ: 均一な太さの2本の帯状の図形が、1点から2方向に伸びている。1本はアンバー(#B5691B)、もう1本は背景よりわずかに暗いティーンで塗る。帯の両端は直角に断ち切られた形状(矢印や三角形の先端は絶対に付けない)。帯は道路や川のような抽象的なパスとして描く。
配置: 右下から左上方向に向かって分岐
重要: 帯の端は四角く断ち切る。矢印・矢じり・三角形・ポインターの形状は絶対に描かない。
${STRICT_RULES}`,
    },
  ],
  業界解説: [
    {
      id: "gyoukai-1",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のグレー(#EEEDE9系、やや濃いめのニュートラルグレー)
モチーフ: 大きさの異なる矩形(長方形)が3〜4個、規則的にグリッド状または階段状に積み重なった抽象図形。1つだけアンバー(#B5691B)でアクセントを付ける。
配置: 左揃えで階段状に積み重なる
${STRICT_RULES}`,
    },
    {
      id: "gyoukai-2",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のグレー(#EEEDE9系、やや濃いめのニュートラルグレー)
モチーフ: 大きさの異なる矩形(長方形)が3〜4個、規則的にグリッド状または階段状に積み重なった抽象図形。1つだけアンバー(#B5691B)でアクセントを付ける。
配置: 中央寄せでグリッド状に配置
${STRICT_RULES}`,
    },
    {
      id: "gyoukai-3",
      prompt: `フラットなミニマル・ベクターイラストを作成してください。
背景: 単色のグレー(#EEEDE9系、やや濃いめのニュートラルグレー)
モチーフ: 大きさの異なる矩形(長方形)が3〜4個、規則的にグリッド状または階段状に積み重なった抽象図形。1つだけアンバー(#B5691B)でアクセントを付ける。
配置: 右下から左上へ斜めに重なる
${STRICT_RULES}`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 画像生成
// ---------------------------------------------------------------------------

async function generateBackground(template, force) {
  const outputPath = path.join(outputDir, `${template.id}.png`);

  if (!force && fs.existsSync(outputPath)) {
    console.log(`[SKIP] 既に存在: ${template.id}.png`);
    return true;
  }

  console.log(`[INFO] 生成中: ${template.id}`);

  try {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: template.prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = result.data[0].b64_json;
    const rawBuffer = Buffer.from(b64, "base64");

    const resized = await sharp(rawBuffer)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "cover" })
      .png()
      .toBuffer();

    fs.writeFileSync(outputPath, resized);
    console.log(`[OK] 保存完了: backgrounds/${template.id}.png (${OUTPUT_WIDTH}x${OUTPUT_HEIGHT})`);
    return true;
  } catch (err) {
    console.error(`[ERROR] ${template.id}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// CLI エントリポイント
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
  const targetCategory = args.find((a) => a !== "--force");

  const categoriesToProcess = targetCategory
    ? { [targetCategory]: TEMPLATES[targetCategory] }
    : TEMPLATES;

  if (targetCategory && !TEMPLATES[targetCategory]) {
    console.error(`[ERROR] 不明なカテゴリ: ${targetCategory}`);
    console.log("有効なカテゴリ: 体験談, エージェント比較, 業界解説");
    process.exit(1);
  }

  let total = 0;
  let ok = 0;
  let fail = 0;

  for (const [category, templates] of Object.entries(categoriesToProcess)) {
    console.log(`\n=== ${category} (${templates.length}パターン) ===`);
    for (const tmpl of templates) {
      total++;
      const success = await generateBackground(tmpl, force);
      if (success) ok++;
      else fail++;

      // レートリミット対策
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n[完了] 合計: ${total}, 成功: ${ok}, 失敗: ${fail}`);
}

main();
