import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { articleImageName, prepareArticleImages } from "./prepare-article-images.mjs";

const directories = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "naru-image-test-"));
  directories.push(dir);
  const inputs = {};
  for (const [i, slot] of ["card", "01", "02", "03"].entries()) {
    const file = path.join(dir, `${slot}.png`);
    await sharp({ create: { width: 80, height: 60, channels: 3,
      background: { r: 20 + i, g: 60, b: 100 } } }).png().toFile(file);
    inputs[slot] = file;
  }
  return { dir, inputs, outputDir: path.join(dir, "out") };
}

describe("four-image preparation", () => {
  it("prepares exactly four appropriately sized WebPs with no embedded metadata", async () => {
    const opts = await fixture();
    const result = await prepareArticleImages({ ...opts, slug: "sample-article" });
    assert.deepEqual(result.map((entry) => entry.slot), ["card", "01", "02", "03"]);
    for (const entry of result) {
      const metadata = await sharp(entry.file).metadata();
      assert.equal(metadata.format, "webp");
      assert.deepEqual([metadata.width, metadata.height], entry.slot === "card" ? [1200, 630] : [1200, 675]);
      for (const key of ["exif", "xmp", "iptc", "icc", "comments"]) assert.equal(metadata[key], undefined);
    }
  });

  it("rejects missing and duplicate inputs without creating output", async () => {
    const opts = await fixture();
    await assert.rejects(prepareArticleImages({ ...opts, slug: "sample", inputs: { card: opts.inputs.card } }), /4枚/);
    await assert.rejects(prepareArticleImages({ ...opts, slug: "sample", inputs: { ...opts.inputs, "01": opts.inputs.card } }), /別々/);
    assert.equal((await readdir(opts.dir)).includes("out"), false);
  });

  it("does not overwrite any existing image or leave partial output", async () => {
    const opts = await fixture();
    await mkdir(opts.outputDir);
    const protectedFile = path.join(opts.outputDir, articleImageName("sample", "02"));
    await writeFile(protectedFile, "original");
    await assert.rejects(prepareArticleImages({ ...opts, slug: "sample" }), /上書きしません/);
    assert.equal(await readFile(protectedFile, "utf8"), "original");
    assert.deepEqual(await readdir(opts.outputDir), ["sample-02.webp"]);
  });

  it("rejects unsafe slugs", () => {
    assert.throws(() => articleImageName("../other", "card"), /slug/);
  });
});
