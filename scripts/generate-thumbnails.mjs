#!/usr/bin/env node
/**
 * サムネイル生成スクリプト
 *
 * 使い方:
 *   node scripts/generate-thumbnails.mjs --slug agent-comparison-2026
 *   node scripts/generate-thumbnails.mjs --all
 *   node scripts/generate-thumbnails.mjs --slug __test-long-title   # ダミーテスト
 *
 * 入力: assets/thumbnail-src/<slug>.png (文字なし元イラスト)
 * 出力: public/images/articles/<slug>-card.png (1200×630, OG/card兼用)
 *
 * 既存の命名規則・パスを維持し、冪等に上書きする。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const SRC_DIR = path.join(ROOT, "assets", "thumbnail-src");
const OUT_DIR = path.join(ROOT, "public", "images", "articles");
const FONT_BOLD = fs.readFileSync(path.join(ROOT, "assets", "fonts", "ZenKakuGothicNew-Bold.ttf"));
const FONT_MEDIUM = fs.readFileSync(path.join(ROOT, "assets", "fonts", "ZenKakuGothicNew-Medium.ttf"));

const W = 1200;
const H = 630;

// カテゴリカラー (バー・バッジ・下線)
const CATEGORY_COLORS = {
  "体験談": "#7A3E2E",
  "エージェント比較": "#D29A4A",
  "業界解説": "#1F6F66",
};

// ── helpers ──

function getFrontmatter(slug) {
  const fp = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(fp)) return null;
  const { data } = matter(fs.readFileSync(fp, "utf-8"));
  return data;
}

function getAllSlugs() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
    .map((f) => f.replace(/\.md$/, ""));
}

/**
 * 外周1pxピクセルのRGB中央値から背景色を推定
 */
async function estimateBgColor(imgBuf) {
  const img = sharp(imgBuf);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  const channels = 4;

  const rs = [], gs = [], bs = [];
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * channels;
      rs.push(raw[i]); gs.push(raw[i + 1]); bs.push(raw[i + 2]);
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const i = (y * width + x) * channels;
      rs.push(raw[i]); gs.push(raw[i + 1]); bs.push(raw[i + 2]);
    }
  }

  const median = (arr) => { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; };
  return { r: median(rs), g: median(gs), b: median(bs) };
}

/**
 * 背景色とのユークリッド距離 > threshold のピクセルのbboxを取得
 */
async function detectContentBbox(imgBuf, bg, threshold = 30) {
  const img = sharp(imgBuf);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  const ch = 4;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * ch;
      const dr = raw[i] - bg.r;
      const dg = raw[i + 1] - bg.g;
      const db = raw[i + 2] - bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) return { x: 0, y: 0, w: width, h: height };

  // 20px外側に拡張
  const pad = 20;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(width, maxX + pad + 1) - Math.max(0, minX - pad),
    h: Math.min(height, maxY + pad + 1) - Math.max(0, minY - pad),
  };
}

/**
 * タイトルを自動折り返し (全角9文字目安)
 */
function wrapTitle(title, maxCharsPerLine = 9) {
  const lines = [];
  let remaining = title;
  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    // 助詞・句読点の後で改行を優先
    let breakAt = -1;
    for (let i = maxCharsPerLine - 1; i >= Math.floor(maxCharsPerLine * 0.6); i--) {
      if ("のをにはでがとも、。—・」】）".includes(remaining[i])) {
        breakAt = i + 1;
        break;
      }
    }
    if (breakAt === -1) breakAt = maxCharsPerLine;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }
  return lines.slice(0, 4); // 最大4行
}

/**
 * Base64エンコード済みフォントデータURI
 */
function fontFaceCSS(name, weight, buf) {
  const b64 = buf.toString("base64");
  return `@font-face { font-family: '${name}'; font-weight: ${weight}; src: url('data:font/truetype;base64,${b64}') format('truetype'); }`;
}

/**
 * 手書き風下線のSVGパス (sin波+右下がりゆらぎ)
 */
function wavyUnderlinePath(x1, x2, y) {
  const len = x2 - x1;
  const amplitude = 3;
  const periods = 1.2;
  const tilt = 2; // 右下がり
  const steps = Math.max(20, Math.floor(len / 4));

  let d = `M ${x1} ${y}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + t * len;
    const py =
      y +
      Math.sin(t * periods * 2 * Math.PI) * amplitude +
      t * tilt;
    d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
  }
  return d;
}

// ── main generation ──

async function generateThumbnail(slug, frontmatterOverride) {
  const fm = frontmatterOverride || getFrontmatter(slug);
  if (!fm) {
    console.error(`  ✗ frontmatter not found: ${slug}`);
    return false;
  }

  const srcPath = path.join(SRC_DIR, `${slug}.png`);
  if (!fs.existsSync(srcPath)) {
    console.error(`  ✗ source image not found: ${srcPath}`);
    return false;
  }

  const title = fm.title || "";
  const category = fm.category || "業界解説";
  const thumbnailTitle = fm.thumbnailTitle || null;
  const catColor = CATEGORY_COLORS[category] || CATEGORY_COLORS["業界解説"];

  // タイトル行の計算
  const titleLines = thumbnailTitle
    ? thumbnailTitle.split("|")
    : wrapTitle(title);

  console.log(`  → ${slug}: "${title}" (${category})`);
  console.log(`    lines: ${JSON.stringify(titleLines)}`);

  // 1. 元イラスト読み込み & 背景色推定
  const srcBuf = fs.readFileSync(srcPath);
  const bg = await estimateBgColor(srcBuf);
  const bgHex = `rgb(${bg.r},${bg.g},${bg.b})`;

  // 3. 実描画範囲検出
  const bbox = await detectContentBbox(srcBuf, bg);

  // bboxで切り出し
  const cropped = await sharp(srcBuf)
    .extract({ left: bbox.x, top: bbox.y, width: bbox.w, height: bbox.h })
    .toBuffer();

  // 4. 左エリアに収まるよう等比縮小 (幅660, 高さ582)
  const leftW = 660; // 696 - 36
  const leftH = 582; // 630 - 48
  const resized = await sharp(cropped)
    .resize(leftW, leftH, { fit: "inside", background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 } })
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const offsetX = Math.round((leftW - resizedMeta.width) / 2);
  const offsetY = Math.round((leftH - resizedMeta.height) / 2) + 24; // 24 = top padding

  // ── SVGオーバーレイ構築 ──
  const panelX = 696;
  const panelW = W - panelX;

  // バッジ
  const badgeX = 740;
  const badgeY = 76;
  const badgePadX = 18;
  const badgePadY = 11;
  const badgeFontSize = 24;
  const badgeTextW = category.length * badgeFontSize; // 概算
  const badgeW = badgeTextW + badgePadX * 2;
  const badgeH = badgeFontSize + badgePadY * 2;
  // バッジ: 全カテゴリで背景色にカテゴリカラー、文字#FBF8F3
  const badgeBg = category === "エージェント比較" ? "#7A3E2E" : catColor;

  // タイトル
  const titleX = 740;
  const titleStartY = badgeY + badgeH + 66;
  const titleFontSize = 46;
  const titleLineHeight = 66;

  // 最終行の下線
  const lastLineIdx = titleLines.length - 1;
  const lastLineY = titleStartY + lastLineIdx * titleLineHeight;
  const underlineY = lastLineY + titleFontSize * 0.15 + 14;

  // 最終行テキスト幅の概算 (全角≒titleFontSize, 半角≒titleFontSize*0.55)
  function estimateTextWidth(text, fontSize) {
    let w = 0;
    for (const ch of text) {
      w += ch.charCodeAt(0) > 127 ? fontSize : fontSize * 0.55;
    }
    return w;
  }
  const lastLineW = estimateTextWidth(titleLines[lastLineIdx], titleFontSize);
  const underlineX1 = titleX;
  const underlineX2 = titleX + lastLineW + 8;

  const wavyPath = wavyUnderlinePath(underlineX1, underlineX2, underlineY);

  // 下部: NARU + サブテキスト
  const naruY = H - 92;
  const subY = H - 50;

  const fontBoldCSS = fontFaceCSS("ZenKaku", 700, FONT_BOLD);
  const fontMediumCSS = fontFaceCSS("ZenKaku", 500, FONT_MEDIUM);

  const titleTextSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${titleX}" y="${titleStartY + i * titleLineHeight}" font-family="ZenKaku" font-weight="700" font-size="${titleFontSize}" fill="#252525">${escXml(line)}</text>`
    )
    .join("\n    ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style>
      ${fontBoldCSS}
      ${fontMediumCSS}
    </style>
  </defs>

  <!-- 右パネル背景 -->
  <rect x="${panelX}" y="0" width="${panelW}" height="${H}" fill="#FBF8F3" />
  <!-- 左ボーダー -->
  <line x1="${panelX}" y1="0" x2="${panelX}" y2="${H}" stroke="#E6DED4" stroke-width="1" />
  <!-- カテゴリカラーバー (上端) -->
  <rect x="${panelX}" y="0" width="${panelW}" height="8" fill="${catColor}" />

  <!-- カテゴリバッジ -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="6" fill="${badgeBg}" />
  <text x="${badgeX + badgePadX}" y="${badgeY + badgePadY + badgeFontSize * 0.78}" font-family="ZenKaku" font-weight="500" font-size="${badgeFontSize}" fill="#FBF8F3">${escXml(category)}</text>

  <!-- タイトル -->
  ${titleTextSvg}

  <!-- 手書き風下線 -->
  <path d="${wavyPath}" stroke="${catColor}" stroke-width="5" fill="none" stroke-linecap="round" />

  <!-- NARU -->
  <text x="${titleX}" y="${naruY}" font-family="ZenKaku" font-weight="700" font-size="30" fill="#1F6F66">NARU</text>
  <!-- サブテキスト -->
  <text x="${titleX}" y="${subY}" font-family="ZenKaku" font-weight="500" font-size="17" fill="#666666">第二新卒の、リアルな転職体験を。</text>
</svg>`;

  // ── 合成 ──
  // 2. キャンバス全面を背景色で塗る
  const canvas = sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: bg.r, g: bg.g, b: bg.b },
    },
  }).png();

  const result = await canvas
    .composite([
      // イラスト (左エリアにセンタリング)
      { input: resized, left: offsetX, top: offsetY },
      // SVGオーバーレイ (右パネル+テキスト)
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${slug}-card.png`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, result);
  console.log(`  ✓ saved: ${outPath}`);
  return true;
}

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);
  let slugs = [];
  let testMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug" && args[i + 1]) {
      slugs.push(args[++i]);
    } else if (args[i] === "--all") {
      slugs = getAllSlugs().filter((s) =>
        fs.existsSync(path.join(SRC_DIR, `${s}.png`))
      );
    }
  }

  // ダミーテスト: 30文字超タイトル
  if (slugs.includes("__test-long-title")) {
    slugs = slugs.filter((s) => s !== "__test-long-title");
    testMode = true;
  }

  if (slugs.length === 0 && !testMode) {
    console.log("Usage:");
    console.log("  node scripts/generate-thumbnails.mjs --slug <slug>");
    console.log("  node scripts/generate-thumbnails.mjs --all");
    console.log("  node scripts/generate-thumbnails.mjs --slug __test-long-title");
    process.exit(1);
  }

  console.log(`\nGenerating thumbnails for ${slugs.length} article(s)...\n`);
  let ok = 0;
  let fail = 0;

  for (const slug of slugs) {
    const success = await generateThumbnail(slug);
    if (success) ok++;
    else fail++;
  }

  if (testMode) {
    // 30文字超ダミーテスト — ソースイラストがある記事の最初の1つを使う
    const testSlug = slugs[0] || getAllSlugs().find((s) => fs.existsSync(path.join(SRC_DIR, `${s}.png`)));
    if (testSlug) {
      console.log("\n--- Long title test ---");
      const success = await generateThumbnail("__test-long-title", {
        title: "第二新卒がIT業界に転職する際に絶対に知っておくべき面接の質問と対策法まとめ",
        category: "体験談",
      });
      if (success) ok++;
      else fail++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
