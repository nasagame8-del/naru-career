#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SLOTS = {
  card: { width: 1200, height: 630 },
  "01": { width: 1200, height: 675 },
  "02": { width: 1200, height: 675 },
  "03": { width: 1200, height: 675 },
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const [slug, slot, inputArg, ...extra] = process.argv.slice(2);
  if (!slug || !slot || !inputArg || extra.length > 0) {
    fail("使い方: npm run image:prepare -- <slug> <card|01|02|03> <元画像パス>");
    return;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail("slugは英小文字・数字・ハイフンだけで指定してください。");
    return;
  }
  const dimensions = SLOTS[slot];
  if (!dimensions) {
    fail("slotは card / 01 / 02 / 03 のいずれかです。");
    return;
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    fail(`元画像が見つかりません: ${inputPath}`);
    return;
  }

  const outputDir = path.join(process.cwd(), "public", "images", "articles");
  const outputPath = path.join(outputDir, `${slug}-${slot}.webp`);
  if (fs.existsSync(outputPath)) {
    fail(`既存画像は上書きしません: ${outputPath}`);
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  await sharp(inputPath)
    .rotate()
    .resize(dimensions.width, dimensions.height, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 88, smartSubsample: true, effort: 5 })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();
  const forbidden = ["exif", "xmp", "iptc", "icc", "comments"].filter(
    (key) => metadata[key] != null
  );
  if (forbidden.length > 0) {
    fs.unlinkSync(outputPath);
    fail(`メタデータ除去を確認できませんでした: ${forbidden.join(", ")}`);
    return;
  }
  if (
    metadata.format !== "webp" ||
    metadata.width !== dimensions.width ||
    metadata.height !== dimensions.height
  ) {
    fs.unlinkSync(outputPath);
    fail("出力形式またはサイズの検証に失敗しました。");
    return;
  }

  console.log(`保存完了: ${outputPath}`);
  console.log(`${metadata.width}x${metadata.height} WebP / 埋め込みメタデータなし`);
  console.log("注意: 画像として描き込まれたAIロゴ・透かしは目視で確認してください。");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
