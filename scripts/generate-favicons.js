/**
 * favicon-source.png から各サイズのfaviconを生成するスクリプト
 *
 * 生成物:
 *   public/favicon.ico       (48x48 ICO)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/favicon.png       (48x48, 既存互換)
 *   public/apple-touch-icon.png (180x180)
 *   src/app/favicon.ico      (Next.js App Router用)
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SOURCE = path.join(__dirname, "..", "public", "favicon-source.png");
const PUBLIC = path.join(__dirname, "..", "public");
const APP = path.join(__dirname, "..", "src", "app");

// PNG ICO encoder — single-image ICO wrapper
function pngToIco(pngBuffer) {
  const imageCount = 1;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * imageCount;

  // Read PNG dimensions from IHDR
  const width = pngBuffer.readUInt32BE(16);
  const height = pngBuffer.readUInt32BE(20);

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);           // reserved
  header.writeUInt16LE(1, 2);           // type: ICO
  header.writeUInt16LE(imageCount, 4);  // image count

  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);              // no palette
  entry.writeUInt8(0, 3);              // reserved
  entry.writeUInt16LE(1, 4);           // color planes
  entry.writeUInt16LE(32, 6);          // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // data size
  entry.writeUInt32LE(dataOffset, 12);       // data offset

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("[ERROR] favicon-source.png が見つかりません");
    process.exit(1);
  }

  const source = sharp(SOURCE);

  // favicon-16x16.png
  await source.clone().resize(16, 16, { fit: "cover" }).png().toFile(path.join(PUBLIC, "favicon-16x16.png"));
  console.log("[OK] favicon-16x16.png");

  // favicon-32x32.png
  await source.clone().resize(32, 32, { fit: "cover" }).png().toFile(path.join(PUBLIC, "favicon-32x32.png"));
  console.log("[OK] favicon-32x32.png");

  // favicon.png (48x48, 既存互換)
  await source.clone().resize(48, 48, { fit: "cover" }).png().toFile(path.join(PUBLIC, "favicon.png"));
  console.log("[OK] favicon.png (48x48)");

  // apple-touch-icon.png (180x180)
  await source.clone().resize(180, 180, { fit: "cover" }).png().toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("[OK] apple-touch-icon.png (180x180)");

  // favicon.ico (48x48 PNG wrapped in ICO)
  const ico48 = await source.clone().resize(48, 48, { fit: "cover" }).ensureAlpha().png().toBuffer();
  const icoBuffer = pngToIco(ico48);
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), icoBuffer);
  console.log("[OK] public/favicon.ico");

  // src/app/favicon.ico (Next.js App Router auto-detection)
  fs.copyFileSync(path.join(PUBLIC, "favicon.ico"), path.join(APP, "favicon.ico"));
  console.log("[OK] src/app/favicon.ico");

  // 旧 src/app/favicon.png を削除（favicon.icoに置き換え）
  const oldAppFavicon = path.join(APP, "favicon.png");
  if (fs.existsSync(oldAppFavicon)) {
    fs.unlinkSync(oldAppFavicon);
    console.log("[OK] 旧 src/app/favicon.png を削除");
  }

  console.log("\n[完了] 全favicon生成完了");
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
});
