import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getArticleImagePath } from "./articles";

/**
 * `getArticleImagePath` は `process.cwd()` を基点に実ファイルの有無を見る。
 *
 * 以前は `vi.spyOn(fs, "existsSync")` でモックしていたが、
 * `articles.ts` は `import fs from "fs"` で束縛済みのため
 * ESMのbindingを差し替えられず、モックが効いていなかった。
 *
 * ここでは実際に一時ディレクトリへ画像ファイルを作り、
 * `process.cwd()`（ESM bindingではなく通常のオブジェクトプロパティ）だけを
 * 差し替えて、**本物のファイル存在判定とフォールバック順序**を検証する。
 * これにより production code の意味は変えずにテストが安定する。
 */
describe("getArticleImagePath", () => {
  let cwd: string;
  let imagesDir: string;

  beforeEach(async () => {
    cwd = await fsp.mkdtemp(path.join(os.tmpdir(), "naru-articles-"));
    imagesDir = path.join(cwd, "public", "images", "articles");
    await fsp.mkdir(imagesDir, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fsp.rm(cwd, { recursive: true, force: true });
  });

  /** 画像の中身は存在判定にしか使われないため、最小のダミーで足りる */
  async function putImage(name: string) {
    await fsp.writeFile(path.join(imagesDir, name), "dummy");
  }

  it("WebPがあれば既存PNGより優先する", async () => {
    // 両方存在する状況を作り、拡張子の優先順位そのものを検証する
    await putImage("sample-card.webp");
    await putImage("sample-card.png");

    expect(getArticleImagePath("sample", "card")).toBe(
      "/images/articles/sample-card.webp"
    );
  });

  it("WebPが無い既存記事ではPNGへフォールバックする", async () => {
    await putImage("sample-card.png");

    expect(getArticleImagePath("sample", "card")).toBe(
      "/images/articles/sample-card.png"
    );
  });

  it("画像が無ければnullを返す", () => {
    expect(getArticleImagePath("sample", "hero")).toBeNull();
  });

  it("kindごとに独立して判定する", async () => {
    await putImage("sample-hero.webp");

    expect(getArticleImagePath("sample", "hero")).toBe(
      "/images/articles/sample-hero.webp"
    );
    // card は用意していないので null のまま
    expect(getArticleImagePath("sample", "card")).toBeNull();
  });

  it("別slugの画像を取り違えない", async () => {
    await putImage("other-card.webp");

    expect(getArticleImagePath("sample", "card")).toBeNull();
    expect(getArticleImagePath("other", "card")).toBe(
      "/images/articles/other-card.webp"
    );
  });
});
