#!/usr/bin/env node

/**
 * 入力フォルダから card / 01 / 02 / 03 を自動検出して WebP 化する。
 *
 *   npm run article:prepare-images -- --slug <slug> --input <folder>
 *
 * 変換そのものは既存の prepareArticleImages() を再利用する。
 * （card→1200x630 / 01-02-03→1200x675 / WebP / メタデータ除去 /
 *   既存画像は上書きしない / 4枚そろって初めて書き込む）
 *
 * OpenAI API・外部APIは使わない。sharp（既存依存）だけを使う。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IMAGE_SLOTS, prepareArticleImages } from "./prepare-article-images.mjs";

/** 受け付ける入力拡張子 */
const INPUT_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function parseArgs(argv) {
  const out = { slug: null, input: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") out.slug = argv[++i] ?? null;
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a === "--input") out.input = argv[++i] ?? null;
    else if (a.startsWith("--input=")) out.input = a.slice("--input=".length);
  }
  return out;
}

/**
 * ファイル名から画像枠を判定する。
 *
 * 判定は「拡張子を除いた名前の末尾」で行う。
 *   card / cover / og  → card
 *   01 / 1 / image1    → "01"
 *   02 / 2             → "02"
 *   03 / 3             → "03"
 *
 * slug を含むファイル名（例 `my-slug-01.png`）もそのまま判定できる。
 */
export function detectSlot(filename) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();

  if (/(?:^|[^a-z])(card|cover|og)$/.test(base)) return "card";

  const m = base.match(/(?:^|[^0-9])0?([1-3])$/);
  if (m) return `0${m[1]}`;

  return null;
}

/**
 * フォルダを走査して枠ごとの入力ファイルを決める。
 *
 * 同じ枠に複数該当した場合は曖昧なので失敗させる（勝手に選ばない）。
 */
export async function resolveInputsFromFolder(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const candidates = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => INPUT_EXTENSIONS.includes(path.extname(n).toLowerCase()));

  const found = new Map();
  const ambiguous = [];

  for (const name of candidates) {
    const slot = detectSlot(name);
    if (!slot) continue;
    if (found.has(slot)) {
      ambiguous.push(`${slot}: ${found.get(slot)} / ${name}`);
      continue;
    }
    found.set(slot, name);
  }

  if (ambiguous.length > 0) {
    throw new Error(
      `同じ枠に複数の画像が該当しました。ファイル名を見直してください — ${ambiguous.join(" , ")}`
    );
  }

  const slots = Object.keys(IMAGE_SLOTS);
  const missing = slots.filter((s) => !found.has(s));
  if (missing.length > 0) {
    throw new Error(
      `次の枠の画像が見つかりません: ${missing.join(", ")}（対象拡張子: ${INPUT_EXTENSIONS.join(" ")}／候補 ${candidates.length} 件）`
    );
  }

  const inputs = {};
  for (const slot of slots) inputs[slot] = path.join(folder, found.get(slot));
  return inputs;
}

// ── CLI ──

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { slug, input } = parseArgs(process.argv.slice(2));

  if (!slug || !input) {
    console.error(
      "使い方: npm run article:prepare-images -- --slug <slug> --input <folder>"
    );
    process.exit(1);
  }

  try {
    const folder = path.resolve(input);
    const stat = await fs.stat(folder);
    if (!stat.isDirectory()) throw new Error(`フォルダではありません: ${folder}`);

    const inputs = await resolveInputsFromFolder(folder);
    console.log("検出した入力画像:");
    for (const [slot, file] of Object.entries(inputs)) {
      console.log(`  ${slot}: ${path.basename(file)}`);
    }

    const outputs = await prepareArticleImages({
      slug,
      inputs,
      outputDir: path.join(process.cwd(), "public", "images", "articles"),
    });

    console.log("");
    for (const item of outputs) {
      console.log(`${item.slot}: ${item.file} (${item.width}x${item.height})`);
    }
    console.log(
      "埋め込みメタデータなし。画面内のAIロゴ・透かし・文字は別途目視で監査してください。"
    );
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
