/**
 * Article Factory の安全判定テスト。
 *
 * 対象は「公開を止められるか」に直結する純粋関数のみ。
 * LLM・ネットワーク・ファイルI/Oには依存しない。
 */

import { describe, it, expect } from "vitest";
import {
  canAutoPublish,
  checkCannibalization,
  checkFrontmatter,
  extractInternalLinkPaths,
  findBrokenInternalLinks,
  findForbiddenPaths,
  findUnsupportedPersonalClaims,
  isAllowedPath,
  isInScope,
  isValidCronAuth,
  isValidSlug,
  refusesSlugOverwrite,
  runQa,
  similarity,
  validateCandidate,
  type ExistingArticleRef,
  type QaInput,
} from "./safety";
import type { ArticleCandidate, ArticleDraft, QaResult, ResearchResult } from "./types";

const EXISTING: ExistingArticleRef[] = [
  {
    slug: "what-is-second-new-grad",
    title: "第二新卒とは？定義・第二新卒枠で使える年齢/年数の目安",
    keyword: "第二新卒とは 定義 年齢",
  },
  {
    slug: "agent-comparison-2026",
    title: "【実体験】第二新卒の転職で使ったエージェント比較——doda・ワークポートのリアルな感想",
    keyword: "第二新卒 転職エージェント 比較 doda ワークポート",
  },
  {
    slug: "second-new-grad-it-career-change",
    title: "第二新卒からIT業界へ転職する方法",
    keyword: "第二新卒 IT 転職",
  },
];

const EXISTING_SLUGS = EXISTING.map((e) => e.slug);

const KNOWN_PATHS = new Set<string>([
  "/",
  "/about",
  "/shindan",
  "/agent-diagnosis",
  "/glossary",
  "/articles/what-is-second-new-grad",
  "/articles/agent-comparison-2026",
  "/category/industry-guide",
]);

function draft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  const base: ArticleDraft = {
    slug: "second-new-grad-resume-basics",
    frontmatter: {
      title: "第二新卒の職務経歴書の書き方",
      category: "業界解説",
      keyword: "第二新卒 職務経歴書 書き方",
      datePublished: "2026-09-23",
      dateModified: "2026-09-23",
      excerpt: "第二新卒が職務経歴書を書くときの基本を解説します。",
      summary: ["職務経歴書の基本構成", "第二新卒ならではの書き方"],
      faq: [{ question: "職歴が短くても書けますか？", answer: "書けます。" }],
      cta_agents: [],
      note_published: false,
    },
    body: "## 見出し\n\n第二新卒の職務経歴書について解説します。[適職診断](/shindan)も参考にしてください。",
    internalLinks: ["/shindan"],
    charCount: 3000,
    ...overrides,
  };
  return base;
}

function research(overrides: Partial<ResearchResult> = {}): ResearchResult {
  return {
    sources: [],
    timeSensitiveClaims: [],
    unsupportedClaims: [],
    ...overrides,
  };
}

function qaInput(overrides: Partial<QaInput> = {}): QaInput {
  return {
    draft: draft(),
    research: research(),
    existing: EXISTING,
    existingSlugs: EXISTING_SLUGS,
    knownPaths: KNOWN_PATHS,
    changePaths: ["content/articles/second-new-grad-resume-basics.md"],
    buildPassed: true,
    ...overrides,
  };
}

// ── カニバリゼーション ──

describe("checkCannibalization", () => {
  it("同じslugの既存記事があれば重複とみなす", () => {
    const v = checkCannibalization(
      { title: "まったく違う題名", primaryKeyword: "別キーワード", slug: "agent-comparison-2026" },
      EXISTING
    );
    expect(v.duplicate).toBe(true);
    expect(v.nearest?.slug).toBe("agent-comparison-2026");
  });

  it("既存記事とほぼ同じタイトルなら重複とみなす", () => {
    const v = checkCannibalization(
      {
        title: "第二新卒とは？定義・第二新卒枠で使える年齢/年数の目安",
        primaryKeyword: "第二新卒とは 定義 年齢",
        slug: "second-new-grad-definition",
      },
      EXISTING
    );
    expect(v.duplicate).toBe(true);
  });

  it("十分に異なるトピックは重複としない", () => {
    const v = checkCannibalization(
      {
        title: "第二新卒の職務経歴書の書き方",
        primaryKeyword: "第二新卒 職務経歴書 書き方",
        slug: "second-new-grad-resume-basics",
      },
      EXISTING
    );
    expect(v.duplicate).toBe(false);
  });

  it("類似度は自分自身に対して1に近い", () => {
    expect(similarity("第二新卒 転職", "第二新卒 転職")).toBeCloseTo(1, 5);
  });
});

// ── スコープ ──

describe("isInScope", () => {
  it("テーマ内の題材を通す", () => {
    expect(isInScope("第二新卒の転職エージェント活用法").ok).toBe(true);
  });

  it("禁止語を含む題材を落とす", () => {
    const r = isInScope("第二新卒が仮想通貨で稼ぐ方法");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("仮想通貨");
  });

  it("関連語を1つも含まない題材を落とす", () => {
    expect(isInScope("おいしいラーメンの作り方").ok).toBe(false);
  });
});

// ── 一人称の実体験 ──

describe("findUnsupportedPersonalClaims", () => {
  it("許可された一次情報の範囲内の記述は通す", () => {
    const body =
      "僕は飲食業界で1年働いたあと、第二新卒でIT業界へ転職しました。応募したのは約30社です。";
    expect(findUnsupportedPersonalClaims(body)).toHaveLength(0);
  });

  it("許可されていない一人称の実体験を検出する", () => {
    const body = "僕は大手商社に在籍していました。当時の上司がとても厳しかったです。";
    const v = findUnsupportedPersonalClaims(body);
    expect(v.length).toBeGreaterThan(0);
  });

  it("一人称でない一般論は検出しない", () => {
    const body = "第二新卒の多くは入社3年以内に転職を検討すると言われています。";
    expect(findUnsupportedPersonalClaims(body)).toHaveLength(0);
  });
});

// ── frontmatter ──

describe("checkFrontmatter", () => {
  it("正しいfrontmatterを通す", () => {
    expect(checkFrontmatter(draft().frontmatter).ok).toBe(true);
  });

  it("必須キーの欠落を検出する", () => {
    const fm = { ...draft().frontmatter } as Record<string, unknown>;
    delete fm.excerpt;
    delete fm.faq;
    const r = checkFrontmatter(fm as never);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("excerpt");
    expect(r.missing).toContain("faq");
  });

  it("日付形式の誤りを検出する", () => {
    const r = checkFrontmatter({ ...draft().frontmatter, datePublished: "2026/09/23" });
    expect(r.ok).toBe(false);
    expect(r.malformed.join(" ")).toContain("datePublished");
  });

  it("未知のカテゴリを検出する", () => {
    const r = checkFrontmatter({ ...draft().frontmatter, category: "雑記" });
    expect(r.ok).toBe(false);
    expect(r.malformed.join(" ")).toContain("category");
  });

  it("nullを完全な欠落として扱う", () => {
    const r = checkFrontmatter(null);
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
  });
});

// ── 内部リンク ──

describe("internal links", () => {
  it("本文からリンクパスを抽出する", () => {
    const paths = extractInternalLinkPaths("[A](/shindan) と [B](/articles/foo) と [C](https://x.com)");
    expect(paths).toEqual(["/shindan", "/articles/foo"]);
  });

  it("実在しないリンクを壊れたリンクとして返す", () => {
    const broken = findBrokenInternalLinks("[X](/diagnosis) [Y](/shindan)", KNOWN_PATHS);
    expect(broken).toEqual(["/diagnosis"]);
  });

  it("実在するリンクのみなら空", () => {
    expect(findBrokenInternalLinks("[Y](/shindan)", KNOWN_PATHS)).toHaveLength(0);
  });
});

// ── パス許可リスト ──

describe("isAllowedPath", () => {
  it("記事パスを許可する", () => {
    expect(isAllowedPath("content/articles/my-new-article.md")).toBe(true);
  });

  it("Run記録・候補バッチを許可する", () => {
    expect(isAllowedPath("data/article-runs/run_123.json")).toBe(true);
    expect(isAllowedPath("data/article-runs/run_123-image-plan.md")).toBe(true);
    expect(isAllowedPath("data/article-candidates/batch_1.json")).toBe(true);
  });

  it("許可外のパスを拒否する", () => {
    expect(isAllowedPath("src/app/page.tsx")).toBe(false);
    expect(isAllowedPath(".github/workflows/deploy.yml")).toBe(false);
    expect(isAllowedPath("package.json")).toBe(false);
    expect(isAllowedPath("prompts/persona.md")).toBe(false);
  });

  it("ディレクトリトラバーサルを拒否する", () => {
    expect(isAllowedPath("content/articles/../../etc/passwd")).toBe(false);
    expect(isAllowedPath("../secrets.md")).toBe(false);
    expect(isAllowedPath("/etc/passwd")).toBe(false);
  });

  it("大文字やアンダースコアを含む記事slugを拒否する", () => {
    expect(isAllowedPath("content/articles/My_Article.md")).toBe(false);
  });

  it("許可外パスだけを列挙する", () => {
    const bad = findForbiddenPaths([
      "content/articles/ok.md",
      "src/middleware.ts",
      "data/article-runs/r.json",
    ]);
    expect(bad).toEqual(["src/middleware.ts"]);
  });
});

// ── slug ──

describe("slug", () => {
  it("正しいslugを通す", () => {
    expect(isValidSlug("second-new-grad-resume")).toBe(true);
  });

  it("不正なslugを落とす", () => {
    expect(isValidSlug("Second_New_Grad")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("日本語スラッグ")).toBe(false);
  });

  it("既存slugの上書きを拒否する", () => {
    expect(refusesSlugOverwrite("agent-comparison-2026", EXISTING_SLUGS)).toBe(true);
    expect(refusesSlugOverwrite("brand-new-slug", EXISTING_SLUGS)).toBe(false);
  });
});

// ── Cron 認証 ──

describe("isValidCronAuth", () => {
  it("正しいBearerトークンを通す", () => {
    expect(isValidCronAuth("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("誤ったトークンを拒否する", () => {
    expect(isValidCronAuth("Bearer wrong", "s3cret")).toBe(false);
  });

  it("secret未設定なら常に拒否する（fail closed）", () => {
    expect(isValidCronAuth("Bearer anything", undefined)).toBe(false);
    expect(isValidCronAuth("Bearer anything", "")).toBe(false);
  });

  it("ヘッダ無しを拒否する", () => {
    expect(isValidCronAuth(null, "s3cret")).toBe(false);
  });

  it("スキームが違えば拒否する", () => {
    expect(isValidCronAuth("Basic s3cret", "s3cret")).toBe(false);
  });
});

// ── QA ──

describe("runQa", () => {
  it("問題のないドラフトはPASSになる", () => {
    const qa = runQa(qaInput());
    expect(qa.overall).toBe("PASS");
    expect(qa.issues).toHaveLength(0);
  });

  it("既存slugの衝突でFAILする", () => {
    const qa = runQa(
      qaInput({
        draft: draft({ slug: "agent-comparison-2026" }),
        changePaths: ["content/articles/agent-comparison-2026.md"],
      })
    );
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "slug-collision")).toBe(true);
  });

  it("壊れた内部リンクでFAILする", () => {
    const qa = runQa(
      qaInput({ draft: draft({ body: "本文 [診断](/diagnosis) です。" }) })
    );
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "internal-links")).toBe(true);
  });

  it("許可外の一人称実体験でFAILする", () => {
    const qa = runQa(
      qaInput({
        draft: draft({ body: "僕は大手商社に在籍していました。前職では営業をしていました。" }),
      })
    );
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "personal-experience")).toBe(true);
  });

  it("出典のない時事的主張でFAILする", () => {
    const qa = runQa(
      qaInput({
        research: research({
          timeSensitiveClaims: ["2026年の有効求人倍率は1.3倍"],
          unsupportedClaims: ["2026年の有効求人倍率は1.3倍"],
        }),
      })
    );
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "sources")).toBe(true);
  });

  it("許可外パスへの書き込みでFAILする", () => {
    const qa = runQa(qaInput({ changePaths: ["src/app/page.tsx"] }));
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "paths")).toBe(true);
  });

  it("frontmatter不備でFAILする", () => {
    const d = draft();
    const fm = { ...d.frontmatter } as Record<string, unknown>;
    delete fm.excerpt;
    const qa = runQa(qaInput({ draft: { ...d, frontmatter: fm as never } }));
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "frontmatter")).toBe(true);
  });

  it("build失敗でFAILする", () => {
    const qa = runQa(qaInput({ buildPassed: false }));
    expect(qa.overall).toBe("FAIL");
    expect(qa.issues.some((i) => i.category === "build")).toBe(true);
  });

  it("build未実行はNEEDS_REVIEWになる", () => {
    const qa = runQa(qaInput({ buildPassed: null }));
    expect(qa.overall).toBe("NEEDS_REVIEW");
  });

  it("短すぎる本文はNEEDS_REVIEWになる", () => {
    const qa = runQa(qaInput({ draft: draft({ charCount: 500 }) }));
    expect(qa.overall).toBe("NEEDS_REVIEW");
  });
});

// ── 自動公開の境界 ──

describe("canAutoPublish", () => {
  const pass: QaResult = { overall: "PASS", issues: [], checkedAt: "2026-09-23T00:00:00.000Z" };

  it("QA未実行なら公開しない", () => {
    expect(canAutoPublish(null, true).allowed).toBe(false);
  });

  it("FAILがあれば公開しない", () => {
    const qa: QaResult = {
      overall: "FAIL",
      issues: [
        { category: "internal-links", verdict: "FAIL", target: "/x", message: "broken" },
      ],
      checkedAt: "2026-09-23T00:00:00.000Z",
    };
    expect(canAutoPublish(qa, true).allowed).toBe(false);
  });

  it("NEEDS_REVIEWがあれば公開しない", () => {
    const qa: QaResult = {
      overall: "NEEDS_REVIEW",
      issues: [{ category: "build", verdict: "NEEDS_REVIEW", target: "x", message: "未実行" }],
      checkedAt: "2026-09-23T00:00:00.000Z",
    };
    expect(canAutoPublish(qa, true).allowed).toBe(false);
  });

  it("QAが通っていてもサーバー側フラグが無ければ公開しない（既定OFF）", () => {
    const r = canAutoPublish(pass, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("ARTICLE_FACTORY_AUTO_PUBLISH");
  });

  it("QA PASS かつ明示的に許可された場合のみ公開できる", () => {
    expect(canAutoPublish(pass, true).allowed).toBe(true);
  });
});

// ── 候補の機械判定 ──

describe("validateCandidate", () => {
  function candidate(overrides: Partial<ArticleCandidate> = {}): ArticleCandidate {
    return {
      id: "c1",
      title: "第二新卒の職務経歴書の書き方",
      primaryKeyword: "第二新卒 職務経歴書 書き方",
      secondaryKeywords: [],
      searchIntent: "know",
      differenceFromExisting: "既存に職務経歴書の記事がない",
      reasonToWriteNow: "転職シーズンで需要が高い",
      category: "業界解説",
      proposedSlug: "second-new-grad-resume-basics",
      riskFlags: [],
      nearestExistingSlugs: [],
      searchEvidence: null,
      blocked: false,
      blockedReasons: [],
      ...overrides,
    };
  }

  it("問題のない候補はblockedにならない", () => {
    const v = validateCandidate(candidate(), EXISTING);
    expect(v.blocked).toBe(false);
  });

  it("重複する候補をblockedにする", () => {
    const v = validateCandidate(
      candidate({
        title: "第二新卒とは？定義・第二新卒枠で使える年齢/年数の目安",
        primaryKeyword: "第二新卒とは 定義 年齢",
        proposedSlug: "second-new-grad-definition",
      }),
      EXISTING
    );
    expect(v.blocked).toBe(true);
    expect(v.riskFlags).toContain("CANNIBALIZATION");
  });

  it("スコープ外の候補をblockedにする", () => {
    const v = validateCandidate(
      candidate({ title: "仮想通貨で稼ぐ方法", primaryKeyword: "仮想通貨 稼ぐ" }),
      EXISTING
    );
    expect(v.blocked).toBe(true);
    expect(v.riskFlags).toContain("OUT_OF_SCOPE");
  });

  it("Search Console根拠が無い場合はフラグを立てる（捏造しない）", () => {
    const v = validateCandidate(candidate({ searchEvidence: null }), EXISTING);
    expect(v.riskFlags).toContain("NO_SEARCH_EVIDENCE");
    expect(v.searchEvidence).toBeNull();
  });
});
