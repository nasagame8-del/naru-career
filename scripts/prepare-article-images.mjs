#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const IMAGE_SLOTS = Object.freeze({
  card: { width: 1200, height: 630 },
  "01": { width: 1200, height: 675 },
  "02": { width: 1200, height: 675 },
  "03": { width: 1200, height: 675 },
});

export function articleImageName(slug, slot) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("slugは英小文字・数字・ハイフンのみ指定できます");
  }
  if (!Object.hasOwn(IMAGE_SLOTS, slot)) {
    throw new Error(`不明な画像枠: ${slot}`);
  }
  return `${slug}-${slot}.webp`;
}

/** Convert all four assets before writing any output. Never overwrite existing images. */
export async function prepareArticleImages({ slug, inputs, outputDir }) {
  const slots = Object.keys(IMAGE_SLOTS);
  if (!inputs || slots.some((slot) => !inputs[slot]) || Object.keys(inputs).length !== 4) {
    throw new Error("card / 01 / 02 / 03 の4枚が必要です");
  }

  const targets = slots.map((slot) => ({
    slot,
    path: path.join(outputDir, articleImageName(slug, slot)),
    input: path.resolve(inputs[slot]),
  }));
  if (new Set(targets.map((item) => item.input)).size !== 4) {
    throw new Error("4つの枠には別々の画像を指定してください");
  }
  for (const target of targets) {
    await fs.access(target.input);
    try {
      await fs.access(target.path);
      throw new Error(`既存画像は上書きしません: ${target.path}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const outputs = await Promise.all(targets.map(async (target) => {
    const size = IMAGE_SLOTS[target.slot];
    const bytes = await sharp(target.input)
      .rotate()
      .resize(size.width, size.height, { fit: "cover", position: "centre" })
      .webp({ quality: 88, smartSubsample: true, effort: 5 })
      .toBuffer();
    const metadata = await sharp(bytes).metadata();
    const forbidden = ["exif", "xmp", "iptc", "icc", "comments"]
      .filter((key) => metadata[key] != null);
    if (metadata.format !== "webp" || metadata.width !== size.width ||
        metadata.height !== size.height || forbidden.length > 0) {
      throw new Error(`${target.slot}: WebP・サイズ・メタデータ検証に失敗しました`);
    }
    return { ...target, bytes, width: size.width, height: size.height };
  }));

  await fs.mkdir(outputDir, { recursive: true });
  const created = [];
  try {
    for (const output of outputs) {
      // wx protects a file created concurrently after the initial existence check.
      await fs.writeFile(output.path, output.bytes, { flag: "wx" });
      created.push(output.path);
    }
  } catch (error) {
    await Promise.all(created.map((file) => fs.unlink(file)));
    throw error;
  }
  return outputs.map(({ slot, path: file, width, height }) => ({ slot, file, width, height }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [slug, card, first, second, third, ...extra] = process.argv.slice(2);
  if (!slug || !card || !first || !second || !third || extra.length) {
    console.error("使い方: npm run image:prepare:all -- <slug> <card画像> <01画像> <02画像> <03画像>");
    process.exitCode = 1;
  } else {
    prepareArticleImages({
      slug,
      inputs: { card, "01": first, "02": second, "03": third },
      outputDir: path.join(process.cwd(), "public", "images", "articles"),
    }).then((outputs) => {
      for (const item of outputs) console.log(`${item.slot}: ${item.file} (${item.width}x${item.height})`);
      console.log("埋め込みメタデータなし。画面内のAIロゴ・透かし・文字は別途目視で監査してください。");
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
