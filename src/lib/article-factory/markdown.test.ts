/**
 * 生成した記事Markdownが、サイト本体と同じパーサ（gray-matter）で
 * 既存記事と同じ形として読めることを確認する。
 *
 * frontmatterの形式ずれは公開後に気づきにくいため、ここで機械的に止める。
 */

import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import {
  buildArticleMarkdown,
  buildImagePlan,
  normalizeArticleBody,
  serializeFrontmatter,
} from "./markdown";
import { checkFrontmatter } from "./safety";
import type { ArticleDraft, ArticleFrontmatter } from "./types";

const FM: ArticleFrontmatter = {
  title: "第二新卒の職務経歴書の書き方",
  category: "業界解説",
  keyword: "第二新卒 職務経歴書 書き方",
  datePublished: "2026-09-23",
  dateModified: "2026-09-23",
  excerpt: "第二新卒が職務経歴書を書くときの基本を解説します。",
  summary: ["基本構成", "第二新卒ならではの書き方", "よくある失敗"],
  faq: [
    { question: "職歴が短くても書けますか？", answer: "書けます。" },
    { question: "空白期間はどう書きますか？", answer: "正直に書きます。" },
  ],
  cta_agents: [],
  note_published: false,
};

const DRAFT: ArticleDraft = {
  slug: "second-new-grad-resume-basics",
  frontmatter: FM,
  body: "## はじめに\n\n本文です。[適職診断](/shindan)もどうぞ。",
  internalLinks: ["/shindan"],
  charCount: 100,
};

describe("serializeFrontmatter", () => {
  it("gray-matterで解析でき、値が往復する", () => {
    const md = buildArticleMarkdown(DRAFT);
    const parsed = matter(md);

    expect(parsed.data.title).toBe(FM.title);
    expect(parsed.data.category).toBe(FM.category);
    expect(parsed.data.keyword).toBe(FM.keyword);
    expect(parsed.data.datePublished).toBe(FM.datePublished);
    expect(parsed.data.excerpt).toBe(FM.excerpt);
    expect(parsed.data.summary).toEqual(FM.summary);
    expect(parsed.data.faq).toEqual(FM.faq);
    expect(parsed.data.cta_agents).toEqual([]);
    expect(parsed.data.note_published).toBe(false);
  });

  it("往復した frontmatter が必須チェックを通る", () => {
    const parsed = matter(buildArticleMarkdown(DRAFT));
    expect(checkFrontmatter(parsed.data as ArticleFrontmatter).ok).toBe(true);
  });

  it("本文がfrontmatterの後ろに保たれる", () => {
    const parsed = matter(buildArticleMarkdown(DRAFT));
    expect(parsed.content.trim()).toBe(DRAFT.body.trim());
  });

  it("本文全体のbodyラッパーを除去し、Markdown見出しを露出させない", () => {
    const wrapped = { ...DRAFT, body: `<body>\n${DRAFT.body}\n</body>` };
    const parsed = matter(buildArticleMarkdown(wrapped));

    expect(parsed.content.trim()).toBe(DRAFT.body);
    expect(parsed.content).not.toContain("<body>");
  });

  it("記事内で意図的に使う通常のHTMLは維持する", () => {
    const body = '## 見出し\n\n<a href="/shindan">診断</a>';
    expect(normalizeArticleBody(body)).toBe(body);
  });

  it("引用符やコロンを含む値を壊さない", () => {
    const tricky: ArticleFrontmatter = {
      ...FM,
      title: 'これは"引用"を含む: タイトル',
      excerpt: "コロン: と「かぎ括弧」を含む説明",
    };
    const parsed = matter(buildArticleMarkdown({ ...DRAFT, frontmatter: tricky }));
    expect(parsed.data.title).toBe(tricky.title);
    expect(parsed.data.excerpt).toBe(tricky.excerpt);
  });

  it("naruPointは値がある時だけ出力される", () => {
    expect(serializeFrontmatter(FM)).not.toContain("naruPoint");
    const withPoint = serializeFrontmatter({ ...FM, naruPoint: "著者の一言" });
    expect(withPoint).toContain("naruPoint:");
  });

  it("cta_agentsが空なら [] として出力される", () => {
    expect(serializeFrontmatter(FM)).toContain("cta_agents: []");
  });

  it("cta_agentsに値があればリストとして出力される", () => {
    const parsed = matter(
      buildArticleMarkdown({ ...DRAFT, frontmatter: { ...FM, cta_agents: ["doda", "workport"] } })
    );
    expect(parsed.data.cta_agents).toEqual(["doda", "workport"]);
  });
});

describe("buildImagePlan", () => {
  it("画像を生成せず、計画だけを出力する", () => {
    const plan = buildImagePlan({
      slug: "test-slug",
      title: "テスト記事",
      articleId: 38,
      headings: ["はじめに", "本題"],
      sources: [],
    });
    expect(plan).toContain("画像プラン");
    expect(plan).toContain("test-slug");
    expect(plan).toContain("自動生成しない");
    expect(plan).toContain("承認済みの既存画像のみ");
    expect(plan).toContain("上書きしない");
  });

  it("見出しを行として含める", () => {
    const plan = buildImagePlan({
      slug: "s",
      title: "T",
      articleId: 1,
      headings: ["第一章"],
      sources: [],
    });
    expect(plan).toContain("第一章");
  });

  it("出典があれば根拠として列挙する", () => {
    const plan = buildImagePlan({
      slug: "s",
      title: "T",
      articleId: 1,
      headings: [],
      sources: [
        {
          title: "厚生労働省 統計",
          url: "https://www.mhlw.go.jp/example",
          retrievedAt: "2026-09-23",
          supportsClaims: ["有効求人倍率"],
          authoritative: true,
        },
      ],
    });
    expect(plan).toContain("厚生労働省 統計");
    expect(plan).toContain("https://www.mhlw.go.jp/example");
  });
});
