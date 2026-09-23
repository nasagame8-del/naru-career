/**
 * sources限定の自動修復のテスト。
 *
 * 守る性質:
 *   - sources 以外の FAIL は修復せず即停止する（安全ゲートを迂回しない）
 *   - 検証済み集合に無いURLは採用しない（出典を捏造しない）
 *   - 本文に無い find は適用しない
 *   - 本文に痕跡が残る主張の「不在」申告は受け付けない
 *   - 同じ引用を重複追加しない
 *   - 最大2回で停止する
 */

import { describe, it, expect } from "vitest";
import {
  applyRepairPlan,
  bodyAlreadyCites,
  claimLikelyPresentInBody,
  classifySourcesFailure,
  decideRepairAction,
  distinctiveTokens,
  MAX_SOURCE_REPAIR_ATTEMPTS,
  unsupportedClaimsToRepair,
  type RepairPlan,
} from "./source-repair";
import type { QaIssue, QaResult, ResearchResult } from "./types";

function qa(issues: Partial<QaIssue>[]): QaResult {
  const full = issues.map((i) => ({
    category: i.category ?? "sources",
    verdict: i.verdict ?? "FAIL",
    target: i.target ?? "t",
    message: i.message ?? "m",
  })) as QaIssue[];
  const overall = full.some((i) => i.verdict === "FAIL")
    ? "FAIL"
    : full.some((i) => i.verdict === "NEEDS_REVIEW")
      ? "NEEDS_REVIEW"
      : "PASS";
  return { overall, issues: full, checkedAt: "2026-09-23T00:00:00.000Z" };
}

function research(overrides: Partial<ResearchResult> = {}): ResearchResult {
  return {
    sources: [],
    timeSensitiveClaims: [],
    unsupportedClaims: [],
    ...overrides,
  };
}

// ── 分類 ──

describe("classifySourcesFailure", () => {
  it("sourcesだけのFAILを修復対象と判定する", () => {
    const c = classifySourcesFailure(qa([{ category: "sources" }]));
    expect(c.hasFail).toBe(true);
    expect(c.sourcesOnly).toBe(true);
    expect(c.otherCategories).toHaveLength(0);
  });

  it("sources以外のFAILがあれば修復対象にしない", () => {
    const c = classifySourcesFailure(
      qa([{ category: "sources" }, { category: "internal-links" }])
    );
    expect(c.sourcesOnly).toBe(false);
    expect(c.otherCategories).toContain("internal-links");
  });

  it("一人称実体験のFAILは修復対象にしない", () => {
    const c = classifySourcesFailure(qa([{ category: "personal-experience" }]));
    expect(c.sourcesOnly).toBe(false);
  });

  it("FAILが無ければ hasFail は false", () => {
    const c = classifySourcesFailure(qa([{ category: "build", verdict: "NEEDS_REVIEW" }]));
    expect(c.hasFail).toBe(false);
    expect(c.sourcesOnly).toBe(false);
  });

  it("sourcesFAILでもNEEDS_REVIEWが併存するだけなら修復対象のまま", () => {
    const c = classifySourcesFailure(
      qa([{ category: "sources" }, { category: "build", verdict: "NEEDS_REVIEW" }])
    );
    expect(c.sourcesOnly).toBe(true);
  });
});

describe("unsupportedClaimsToRepair", () => {
  it("sourcesのみFAILなら research の unsupportedClaims を返す", () => {
    const r = research({ unsupportedClaims: ["主張A", "主張B"] });
    expect(unsupportedClaimsToRepair(qa([{ category: "sources" }]), r)).toEqual(["主張A", "主張B"]);
  });

  it("他FAIL併存なら空", () => {
    const r = research({ unsupportedClaims: ["主張A"] });
    expect(
      unsupportedClaimsToRepair(qa([{ category: "sources" }, { category: "paths" }]), r)
    ).toHaveLength(0);
  });
});

// ── 修復ループの制御 ──

describe("decideRepairAction", () => {
  it("FAILが無ければ proceed", () => {
    const d = decideRepairAction(qa([]), research(), 0);
    expect(d.action).toBe("proceed");
  });

  it("sourcesだけのFAILなら repair", () => {
    const d = decideRepairAction(
      qa([{ category: "sources" }]),
      research({ unsupportedClaims: ["主張A"] }),
      0
    );
    expect(d.action).toBe("repair");
    if (d.action === "repair") {
      expect(d.attempt).toBe(1);
      expect(d.claims).toEqual(["主張A"]);
    }
  });

  it("sources以外のFAILがあれば即stop（修復しない）", () => {
    const d = decideRepairAction(
      qa([{ category: "internal-links", message: "壊れたリンク" }]),
      research(),
      0
    );
    expect(d.action).toBe("stop");
    if (d.action === "stop") expect(d.code).toBe("QA_FAIL");
  });

  it("sourcesと他FAILの併存でも安全停止する", () => {
    const d = decideRepairAction(
      qa([{ category: "sources" }, { category: "personal-experience" }]),
      research({ unsupportedClaims: ["主張A"] }),
      0
    );
    expect(d.action).toBe("stop");
  });

  it("上限回数に達したら stop（PRを作らない）", () => {
    const d = decideRepairAction(
      qa([{ category: "sources" }]),
      research({ unsupportedClaims: ["主張A"] }),
      MAX_SOURCE_REPAIR_ATTEMPTS
    );
    expect(d.action).toBe("stop");
    if (d.action === "stop") expect(d.code).toBe("QA_FAIL_SOURCES_UNREPAIRED");
  });

  it("最大2回までは repair を返す", () => {
    const r = research({ unsupportedClaims: ["主張A"] });
    expect(decideRepairAction(qa([{ category: "sources" }]), r, 0).action).toBe("repair");
    expect(decideRepairAction(qa([{ category: "sources" }]), r, 1).action).toBe("repair");
    expect(decideRepairAction(qa([{ category: "sources" }]), r, 2).action).toBe("stop");
    expect(MAX_SOURCE_REPAIR_ATTEMPTS).toBe(2);
  });

  it("修復後PASSになれば proceed（PR作成へ進む）", () => {
    const d = decideRepairAction(qa([]), research({ unsupportedClaims: [] }), 1);
    expect(d.action).toBe("proceed");
  });
});

// ── 本文中の痕跡判定 ──

describe("distinctiveTokens / claimLikelyPresentInBody", () => {
  it("年・割合・倍率・金額を特徴トークンとして拾う", () => {
    const t = distinctiveTokens("2026年の有効求人倍率は1.3倍、平均年収は400万円で前年比5%増");
    expect(t).toContain("2026年");
    expect(t).toContain("1.3倍");
    expect(t).toContain("400万円");
    expect(t).toContain("5%");
  });

  it("英数字の固有名詞を拾う", () => {
    expect(distinctiveTokens("GA4の導入率")).toContain("ga4");
  });

  it("本文に特徴トークンが残っていれば present と判定する", () => {
    expect(claimLikelyPresentInBody("2026年の求人倍率は1.3倍", "本文には2026年の記述がある")).toBe(true);
  });

  it("特徴トークンが消えていれば absent と判定する", () => {
    expect(claimLikelyPresentInBody("2026年の求人倍率は1.3倍", "一般的な傾向を述べるのみ")).toBe(false);
  });

  it("特徴トークンが取れない主張は安全側で present とみなす", () => {
    expect(claimLikelyPresentInBody("転職市場は活発である", "まったく関係のない本文")).toBe(true);
  });
});

describe("bodyAlreadyCites", () => {
  it("同じURLが本文にあれば true", () => {
    expect(bodyAlreadyCites("[出典](https://mhlw.go.jp/x)", "https://mhlw.go.jp/x")).toBe(true);
  });
  it("表記揺れでも正規化して判定する", () => {
    expect(bodyAlreadyCites("[出典](https://mhlw.go.jp/x)", "https://www.mhlw.go.jp/x/")).toBe(true);
  });
  it("無ければ false", () => {
    expect(bodyAlreadyCites("本文のみ", "https://mhlw.go.jp/x")).toBe(false);
  });
});

// ── プラン適用 ──

const VERIFIED = [
  { url: "https://mhlw.go.jp/stat", title: "厚労省 統計", authoritative: true },
];

function emptyPlan(): RepairPlan {
  return { citations: [], edits: [], notPresent: [] };
}

describe("applyRepairPlan", () => {
  it("検証済みURLの引用を追加し、主張を解消する", () => {
    const r = applyRepairPlan({
      body: "本文です。有効求人倍率は1.3倍です。",
      research: research({ unsupportedClaims: ["有効求人倍率は1.3倍"] }),
      plan: {
        ...emptyPlan(),
        citations: [
          {
            claim: "有効求人倍率は1.3倍",
            url: "https://mhlw.go.jp/stat",
            title: "厚労省 統計",
            anchorText: "有効求人倍率は1.3倍です。",
          },
        ],
      },
      verifiedUrls: VERIFIED,
      targetClaims: ["有効求人倍率は1.3倍"],
      retrievedAt: "2026-09-23",
    });
    expect(r.citationsAdded).toBe(1);
    expect(r.body).toContain("https://mhlw.go.jp/stat");
    expect(r.research.unsupportedClaims).toHaveLength(0);
    expect(r.research.sources.map((s) => s.url)).toContain("https://mhlw.go.jp/stat");
  });

  it("検証済み集合に無いURLは採用しない（捏造防止）", () => {
    const r = applyRepairPlan({
      body: "本文です。",
      research: research({ unsupportedClaims: ["主張A"] }),
      plan: {
        ...emptyPlan(),
        citations: [
          {
            claim: "主張A",
            url: "https://made-up.example.org/report",
            title: "でっちあげ",
            anchorText: null,
          },
        ],
      },
      verifiedUrls: VERIFIED,
      targetClaims: ["主張A"],
      retrievedAt: "2026-09-23",
    });
    expect(r.citationsAdded).toBe(0);
    expect(r.body).not.toContain("made-up.example.org");
    expect(r.research.unsupportedClaims).toEqual(["主張A"]);
    expect(r.rejected.join(" ")).toContain("確認できないURL");
  });

  it("同じ引用を重複追加しない", () => {
    const body = "本文。\n\n> 出典: [厚労省 統計](https://mhlw.go.jp/stat)\n";
    const r = applyRepairPlan({
      body,
      research: research({ unsupportedClaims: ["主張A"] }),
      plan: {
        ...emptyPlan(),
        citations: [
          { claim: "主張A", url: "https://mhlw.go.jp/stat", title: "厚労省 統計", anchorText: null },
        ],
      },
      verifiedUrls: VERIFIED,
      targetClaims: ["主張A"],
      retrievedAt: "2026-09-23",
    });
    expect(r.citationsAdded).toBe(0);
    // 本文は変わらないが、主張としては裏付けが取れているので解消される
    expect(r.body).toBe(body);
    expect((r.body.match(/mhlw\.go\.jp\/stat/g) || []).length).toBe(1);
    expect(r.research.unsupportedClaims).toHaveLength(0);
  });

  it("本文から該当箇所を削除して主張を解消する", () => {
    const r = applyRepairPlan({
      body: "前段です。2026年の求人倍率は1.3倍です。後段です。",
      research: research({
        unsupportedClaims: ["2026年の求人倍率は1.3倍"],
        timeSensitiveClaims: ["2026年の求人倍率は1.3倍"],
      }),
      plan: {
        ...emptyPlan(),
        edits: [
          {
            claim: "2026年の求人倍率は1.3倍",
            find: "2026年の求人倍率は1.3倍です。",
            replace: "",
            action: "remove",
          },
        ],
      },
      verifiedUrls: [],
      targetClaims: ["2026年の求人倍率は1.3倍"],
      retrievedAt: "2026-09-23",
    });
    expect(r.editsApplied).toBe(1);
    expect(r.body).not.toContain("1.3倍");
    expect(r.research.unsupportedClaims).toHaveLength(0);
    expect(r.research.timeSensitiveClaims).toHaveLength(0);
  });

  it("断定を弱める修正も適用できる", () => {
    const r = applyRepairPlan({
      body: "2026年の平均年収は400万円です。",
      research: research({ unsupportedClaims: ["2026年の平均年収は400万円"] }),
      plan: {
        ...emptyPlan(),
        edits: [
          {
            claim: "2026年の平均年収は400万円",
            find: "2026年の平均年収は400万円です。",
            replace: "年収は経験や企業規模によって幅があります。",
            action: "soften",
          },
        ],
      },
      verifiedUrls: [],
      targetClaims: ["2026年の平均年収は400万円"],
      retrievedAt: "2026-09-23",
    });
    expect(r.editsApplied).toBe(1);
    expect(r.body).toContain("幅があります");
    expect(r.body).not.toContain("400万円");
  });

  it("本文に存在しない find は適用しない", () => {
    const r = applyRepairPlan({
      body: "本文です。",
      research: research({ unsupportedClaims: ["主張A"] }),
      plan: {
        ...emptyPlan(),
        edits: [
          { claim: "主張A", find: "本文に無い文字列", replace: "x", action: "remove" },
        ],
      },
      verifiedUrls: [],
      targetClaims: ["主張A"],
      retrievedAt: "2026-09-23",
    });
    expect(r.editsApplied).toBe(0);
    expect(r.body).toBe("本文です。");
    expect(r.research.unsupportedClaims).toEqual(["主張A"]);
    expect(r.rejected.join(" ")).toContain("一致する箇所がありません");
  });

  it("本文に痕跡が残る主張の不在申告は受け付けない", () => {
    const r = applyRepairPlan({
      body: "2026年の求人倍率は1.3倍という記述が残っている。",
      research: research({ unsupportedClaims: ["2026年の求人倍率は1.3倍"] }),
      plan: { ...emptyPlan(), notPresent: ["2026年の求人倍率は1.3倍"] },
      verifiedUrls: [],
      targetClaims: ["2026年の求人倍率は1.3倍"],
      retrievedAt: "2026-09-23",
    });
    expect(r.claimsDropped).toBe(0);
    expect(r.research.unsupportedClaims).toEqual(["2026年の求人倍率は1.3倍"]);
    expect(r.rejected.join(" ")).toContain("痕跡が残っています");
  });

  it("本文に本当に存在しない主張は取り下げられる", () => {
    const r = applyRepairPlan({
      body: "一般的な心構えだけを述べた本文。",
      research: research({ unsupportedClaims: ["2026年の求人倍率は1.3倍"] }),
      plan: { ...emptyPlan(), notPresent: ["2026年の求人倍率は1.3倍"] },
      verifiedUrls: [],
      targetClaims: ["2026年の求人倍率は1.3倍"],
      retrievedAt: "2026-09-23",
    });
    expect(r.claimsDropped).toBe(1);
    expect(r.research.unsupportedClaims).toHaveLength(0);
  });

  it("修復対象外の主張には手を出さない", () => {
    const r = applyRepairPlan({
      body: "本文です。",
      research: research({ unsupportedClaims: ["主張A"] }),
      plan: {
        ...emptyPlan(),
        citations: [
          { claim: "別の主張", url: "https://mhlw.go.jp/stat", title: "T", anchorText: null },
        ],
      },
      verifiedUrls: VERIFIED,
      targetClaims: ["主張A"],
      retrievedAt: "2026-09-23",
    });
    expect(r.citationsAdded).toBe(0);
    expect(r.rejected.join(" ")).toContain("対象外の主張");
  });

  it("frontmatterや内部リンクを壊さない（本文以外に触れない）", () => {
    const body = "本文。[適職診断](/shindan)を参照。2026年の統計です。";
    const r = applyRepairPlan({
      body,
      research: research({ unsupportedClaims: ["2026年の統計"] }),
      plan: {
        ...emptyPlan(),
        edits: [
          { claim: "2026年の統計", find: "2026年の統計です。", replace: "", action: "remove" },
        ],
      },
      verifiedUrls: [],
      targetClaims: ["2026年の統計"],
      retrievedAt: "2026-09-23",
    });
    // 内部リンクは保持される
    expect(r.body).toContain("[適職診断](/shindan)");
  });

  it("既存の出典を失わない", () => {
    const r = applyRepairPlan({
      body: "本文です。",
      research: research({
        sources: [
          {
            title: "既存",
            url: "https://example.com/a",
            retrievedAt: "2026-09-20",
            supportsClaims: ["既存主張"],
            authoritative: false,
          },
        ],
        unsupportedClaims: ["主張A"],
      }),
      plan: {
        ...emptyPlan(),
        citations: [
          { claim: "主張A", url: "https://mhlw.go.jp/stat", title: "厚労省", anchorText: null },
        ],
      },
      verifiedUrls: VERIFIED,
      targetClaims: ["主張A"],
      retrievedAt: "2026-09-23",
    });
    const urls = r.research.sources.map((s) => s.url);
    expect(urls).toContain("https://example.com/a");
    expect(urls).toContain("https://mhlw.go.jp/stat");
  });
});

// ── Workflowサンドボックスへの混入防止（回帰テスト） ──

describe("workflow 生成バンドルの監査", () => {
  /**
   * `"use workflow"` は Node.js VM 内で動くため、
   * process.env / Node builtin / OpenAI / GitHub 呼び出しが
   * flow バンドルへ入ってはいけない。
   *
   * source-repair の純粋ロジックを workflow 本体から使う一方で、
   * planSourceRepair（OpenAI依存）は step 内でのみ使うよう
   * モジュールを分離している。その分離が壊れると
   * ここで検出される。
   *
   * バンドルは `npm run build` で生成されるため、
   * 未ビルドの場合はスキップする（CIでは build 後に別途監査する）。
   */
  const BUNDLE = "src/app/.well-known/workflow/v1/flow/route.js";

  it("flowバンドルに process.env / Node builtin / OpenAI / GitHub が混入しない", async () => {
    const fs = await import("fs");
    if (!fs.existsSync(BUNDLE)) {
      // 未ビルド。ここでは判定しない。
      expect(true).toBe(true);
      return;
    }
    const src = fs.readFileSync(BUNDLE, "utf8");

    const forbidden = [
      "process.env",
      "process.",
      'require("fs")',
      'require("path")',
      'require("crypto")',
      'require("child_process")',
      "node:fs",
      "node:path",
      "node:crypto",
      "readFileSync",
      "__dirname",
      "api.github.com",
      "OPENAI_API_KEY",
      "GITHUB_TOKEN",
      "ARTICLE_FACTORY_MODEL",
      "planSourceRepair",
      "performClaimSearch",
      "runStructured",
    ];

    const found = forbidden.filter((f) => src.includes(f));
    expect(found).toEqual([]);
  });

  it("source-repair（純粋モジュール）が OpenAI / config を import しない", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/article-factory/source-repair.ts", "utf8");
    expect(src).not.toContain("seo-editor/openai");
    expect(src).not.toContain('from "./config"');
    expect(src).not.toContain('from "./research"');
  });

  it("planner（OpenAI依存）は workflow 本体から直接 import されない", async () => {
    const fs = await import("fs");
    const wf = fs.readFileSync("src/lib/article-factory/workflow.ts", "utf8");
    // planSourceRepair は step 内でのみ使う。import 自体は専用モジュールから行う。
    expect(wf).toContain('from "./source-repair-planner"');
    // 純粋ロジックは source-repair から取る
    expect(wf).toContain('from "./source-repair"');
  });
});
