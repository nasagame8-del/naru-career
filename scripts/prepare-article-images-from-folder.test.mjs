import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  parseArgs,
  detectSlot,
  resolveInputsFromFolder,
} from "./prepare-article-images-from-folder.mjs";
import { prepareArticleImages, IMAGE_SLOTS } from "./prepare-article-images.mjs";

// ── 引数 ──

test("parseArgs は --slug / --input の両形式を読む", () => {
  assert.deepEqual(parseArgs(["--slug", "a", "--input", "b"]), { slug: "a", input: "b" });
  assert.deepEqual(parseArgs(["--slug=a", "--input=b"]), { slug: "a", input: "b" });
});

// ── 枠の判定 ──

test("detectSlot は card / cover / og を card と判定する", () => {
  assert.equal(detectSlot("card.png"), "card");
  assert.equal(detectSlot("my-slug-card.webp"), "card");
  assert.equal(detectSlot("cover.jpg"), "card");
  assert.equal(detectSlot("OG.PNG"), "card");
});

test("detectSlot は 01/02/03 と 1/2/3 を判定する", () => {
  assert.equal(detectSlot("01.png"), "01");
  assert.equal(detectSlot("1.png"), "01");
  assert.equal(detectSlot("my-slug-02.jpeg"), "02");
  assert.equal(detectSlot("image3.webp"), "03");
});

test("detectSlot は該当しないファイルを null にする", () => {
  assert.equal(detectSlot("notes.txt"), null);
  assert.equal(detectSlot("hero.png"), null);
  assert.equal(detectSlot("04.png"), null);
  assert.equal(detectSlot("random.png"), null);
});

// ── フォルダ走査 ──

async function makeDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "naru-img-"));
}

async function writePng(file, width, height) {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  await fs.writeFile(file, buf);
}

test("resolveInputsFromFolder は4枠を検出する", async () => {
  const dir = await makeDir();
  try {
    for (const n of ["card.png", "01.png", "02.png", "03.png"]) {
      await writePng(path.join(dir, n), 40, 30);
    }
    await fs.writeFile(path.join(dir, "memo.txt"), "ignored");

    const inputs = await resolveInputsFromFolder(dir);
    assert.deepEqual(Object.keys(inputs).sort(), ["01", "02", "03", "card"]);
    assert.equal(path.basename(inputs.card), "card.png");
    assert.equal(path.basename(inputs["03"]), "03.png");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("resolveInputsFromFolder はslug付きファイル名でも検出する", async () => {
  const dir = await makeDir();
  try {
    for (const n of ["my-slug-card.png", "my-slug-01.jpg", "my-slug-02.webp", "my-slug-03.jpeg"]) {
      await writePng(path.join(dir, n), 40, 30);
    }
    const inputs = await resolveInputsFromFolder(dir);
    assert.equal(Object.keys(inputs).length, 4);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("resolveInputsFromFolder は枠不足を明示して失敗する", async () => {
  const dir = await makeDir();
  try {
    await writePng(path.join(dir, "card.png"), 40, 30);
    await writePng(path.join(dir, "01.png"), 40, 30);
    await assert.rejects(() => resolveInputsFromFolder(dir), /02, 03/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("resolveInputsFromFolder は同一枠の重複を勝手に選ばず失敗する", async () => {
  const dir = await makeDir();
  try {
    for (const n of ["card.png", "cover.png", "01.png", "02.png", "03.png"]) {
      await writePng(path.join(dir, n), 40, 30);
    }
    await assert.rejects(() => resolveInputsFromFolder(dir), /同じ枠に複数/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ── フォルダ検出 → 既存変換 の結合 ──

test("検出した4枚を既存の変換に通すと規定サイズのWebPになる", async () => {
  const input = await makeDir();
  const output = await makeDir();
  try {
    // 入力は意図的に小さく・比率も違う状態にする
    await writePng(path.join(input, "card.png"), 400, 400);
    await writePng(path.join(input, "01.png"), 300, 500);
    await writePng(path.join(input, "02.png"), 900, 200);
    await writePng(path.join(input, "03.png"), 640, 480);

    const inputs = await resolveInputsFromFolder(input);
    const outputs = await prepareArticleImages({
      slug: "folder-detect-test",
      inputs,
      outputDir: output,
    });

    assert.equal(outputs.length, 4);
    for (const item of outputs) {
      const expected = IMAGE_SLOTS[item.slot];
      // Windowsではパス渡しだとsharpがハンドルを保持して後片付けが失敗するため、
      // バッファを読み込んで検証する。
      const meta = await sharp(await fs.readFile(item.file)).metadata();
      assert.equal(meta.format, "webp", `${item.slot} がwebpではありません`);
      assert.equal(meta.width, expected.width);
      assert.equal(meta.height, expected.height);
      for (const key of ["exif", "xmp", "iptc", "icc", "comments"]) {
        assert.equal(meta[key], undefined, `${item.slot} に ${key} が残っています`);
      }
    }
  } finally {
    await fs.rm(input, { recursive: true, force: true });
    await fs.rm(output, { recursive: true, force: true });
  }
});

test("既存の出力があるとき上書きしない", async () => {
  const input = await makeDir();
  const output = await makeDir();
  try {
    for (const n of ["card.png", "01.png", "02.png", "03.png"]) {
      await writePng(path.join(input, n), 200, 200);
    }
    await fs.writeFile(path.join(output, "dup-test-card.webp"), "existing");

    const inputs = await resolveInputsFromFolder(input);
    await assert.rejects(
      () => prepareArticleImages({ slug: "dup-test", inputs, outputDir: output }),
      /既存画像は上書きしません/
    );
    // 既存ファイルは変更されない
    assert.equal(await fs.readFile(path.join(output, "dup-test-card.webp"), "utf8"), "existing");
  } finally {
    await fs.rm(input, { recursive: true, force: true });
    await fs.rm(output, { recursive: true, force: true });
  }
});
