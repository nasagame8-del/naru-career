import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertBoldMarkers,
  convertLabeledBoxes,
  getAllSlugs,
  getArticle,
  getArticleImagePath,
  getArticleMeta,
  htmlToPlainText,
  removeFaqSection,
  renderArticleMarkdown,
} from "./articles";

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

describe("Markdown前処理", () => {
  it("日本語の括弧に隣接した ** も太字にする", () => {
    expect(convertBoldMarkers("これは**「重要」**です")).toBe(
      "これは<strong>「重要」</strong>です"
    );
  });

  it("行をまたぐ ** は変換しない", () => {
    expect(convertBoldMarkers("**a\nb**")).toBe("**a\nb**");
  });

  it("よくある質問セクションだけを除き、後続のH2は残す", () => {
    const md = "## 本文\nA\n\n## よくある質問\n\n### Q: x\ny\n\n## おすすめ\nB\n";
    expect(removeFaqSection(md)).toBe("## 本文\nA\n\n## おすすめ\nB\n");
  });

  it("よくある質問が末尾なら最後まで除く", () => {
    expect(removeFaqSection("## 本文\nA\n\n## よくある質問\n### Q\nz\n")).toBe(
      "## 本文\nA\n\n"
    );
  });

  it("見出しHTMLをプレーンテキストに戻す", () => {
    expect(htmlToPlainText("面接対策（Q&#x26;A形式）<strong>必読</strong>")).toBe(
      "面接対策（Q&A形式）必読"
    );
  });
});

describe("content/articles のインラインFAQ", () => {
  it("frontmatterのinlineFaqはすべて対応するH2の直後に表示される", async () => {
    const missing: string[] = [];
    for (const slug of getAllSlugs()) {
      const declared = getArticleMeta(slug).inlineFaq;
      if (declared.length === 0) continue;
      const placed = (await getArticle(slug)).inlineFaq;
      for (const faq of declared) {
        if (!placed.includes(faq) && !placed.some((p) => p.heading === faq.heading)) {
          missing.push(`${slug}: ${faq.heading}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("ラベル付き囲みボックス記法", () => {
  it("ラベルと中身を .naru-box のHTMLへ変換する", () => {
    expect(convertLabeledBoxes(":::box 確認すること\n本文\n:::")).toBe(
      '<div class="naru-box">\n\n<p class="naru-box-label">確認すること</p>\n\n本文\n\n</div>'
    );
  });

  it("ラベルを省略できる", () => {
    expect(convertLabeledBoxes(":::box\n本文\n:::")).toBe(
      '<div class="naru-box">\n\n本文\n\n</div>'
    );
  });

  it("ラベルのHTMLをエスケープする", () => {
    expect(convertLabeledBoxes(':::box <img src=x onerror="1">\n本文\n:::')).toContain(
      '<p class="naru-box-label">&lt;img src=x onerror="1"&gt;</p>'
    );
  });

  it("閉じていない記法は本文のまま残す", () => {
    const md = ":::box ラベル\n本文だけで閉じない\n";
    expect(convertLabeledBoxes(md)).toBe(md);
  });

  it("1本の記事に複数のボックスを置ける", () => {
    const html = convertLabeledBoxes(":::box A\n1\n:::\n\n段落\n\n:::box B\n2\n:::");
    expect(html.match(/naru-box-label/g)).toHaveLength(2);
    expect(html).toContain("\n\n段落\n\n");
  });

  it("ボックスの外は書き換えない", () => {
    const md = "## 見出し\n\n本文です。\n\n- 箇条書き\n";
    expect(convertLabeledBoxes(md)).toBe(md);
  });

  it("中身の箇条書き・太字・リンクはMarkdownとして解釈される", async () => {
    const md = convertLabeledBoxes(
      ":::box 応募前チェック\n- **職務内容**が書面にあるか\n- [相談先](/contact)を控えたか\n:::"
    );
    const rendered = await renderArticleMarkdown(convertBoldMarkers(md));
    expect(rendered).toContain('<div class="naru-box">');
    expect(rendered).toContain('<p class="naru-box-label">応募前チェック</p>');
    expect(rendered).toContain("<ul>");
    expect(rendered).toContain("<strong>職務内容</strong>");
    expect(rendered).toContain('<a href="/contact">相談先</a>');
    expect(rendered).toContain("</div>");
    // 記法そのものは画面へ出ない
    expect(rendered).not.toContain(":::");
  });

  it("中身の表はGFMの表として解釈される", async () => {
    const md = convertLabeledBoxes(
      ":::box 比較\n| 項目 | 値 |\n| --- | --- |\n| A | 1 |\n:::"
    );
    const rendered = await renderArticleMarkdown(md);
    expect(rendered).toContain("<table>");
    expect(rendered).toContain('<div class="naru-box">');
  });
});
