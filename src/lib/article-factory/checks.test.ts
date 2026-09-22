/**
 * 外部CIチェックと本番デプロイの判定テスト。
 *
 * ここが守る性質:
 *   - pending を pass にしない
 *   - missing を pass にしない
 *   - timeout を pass にしない
 *   - チェックが通るまでマージできない
 *   - 本番デプロイ成功前に本番URLを返さない
 */

import { describe, it, expect } from "vitest";
import {
  ARTICLE_FACTORY_CHECK_NAME,
  evaluateDeployment,
  evaluateMergeGate,
  evaluateRequiredChecks,
  isProductionEnvironment,
  isVercelDeploymentCheckName,
  latestPerCheck,
  REQUIRED_CHECKS,
  type CheckSummary,
  type DeploymentRecord,
  type DeploymentStatusRecord,
  type RequiredChecksDecision,
} from "./checks";

const OPTS = {
  elapsedMs: 60_000,
  timeoutMs: 20 * 60 * 1000,
  appearanceGraceMs: 3 * 60 * 1000,
};

let seq = 1000;

/**
 * 実APIの形に近いチェックを作る。
 * 既定では検証ジョブは GitHub Actions の check-run、
 * Vercel は vercel[bot] の commit status（実リポジトリで観測した形）として作る。
 */
function check(
  name: string,
  status: CheckSummary["status"],
  conclusion: CheckSummary["conclusion"],
  over: Partial<CheckSummary> = {}
): CheckSummary {
  const isVercel = /^vercel/i.test(name);
  return {
    source: isVercel ? "commit_status" : "check_run",
    id: seq++,
    name,
    origin: isVercel ? "vercel[bot]" : "github-actions",
    observedAt: null,
    status,
    conclusion,
    ...over,
  };
}

/** 時刻つきの試行（at は分単位のオフセット） */
function at(min: number): string {
  return new Date(Date.UTC(2026, 8, 22, 12, min)).toISOString();
}

const PASSING: CheckSummary[] = [
  check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
  check("Vercel – naru-career", "completed", "success"),
];

describe("evaluateRequiredChecks", () => {
  it("必須チェックがすべて成功していれば passed", () => {
    const d = evaluateRequiredChecks(PASSING, REQUIRED_CHECKS, OPTS);
    expect(d.state).toBe("passed");
  });

  it("いずれかが実行中なら pending（pass にしない）", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "in_progress", null), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("pending");
  });

  it("queued も pending 扱い", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "queued", null), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("pending");
  });

  it("失敗したチェックがあれば failed", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure"), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
    if (d.state === "failed") expect(d.detail).toContain(ARTICLE_FACTORY_CHECK_NAME);
  });

  it("cancelled も失敗として扱う", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "cancelled"), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("timed_out も失敗として扱う", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "timed_out"), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("skipped は成功として扱わない", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "skipped"), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("neutral も成功として扱わない", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "neutral"), PASSING[1]],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("猶予内に未登録なら pending（missing にしない）", () => {
    const d = evaluateRequiredChecks([], REQUIRED_CHECKS, {
      ...OPTS,
      elapsedMs: 30_000,
    });
    expect(d.state).toBe("pending");
  });

  it("猶予を過ぎても未登録なら missing（pass にしない）", () => {
    const d = evaluateRequiredChecks([], REQUIRED_CHECKS, {
      ...OPTS,
      elapsedMs: 5 * 60 * 1000,
    });
    expect(d.state).toBe("missing");
    if (d.state === "missing") {
      expect(d.missing).toContain(ARTICLE_FACTORY_CHECK_NAME);
      expect(d.missing).toContain("Vercel Preview");
    }
  });

  it("Vercelチェックだけ欠けている場合も missing", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success")],
      REQUIRED_CHECKS,
      { ...OPTS, elapsedMs: 5 * 60 * 1000 }
    );
    expect(d.state).toBe("missing");
    if (d.state === "missing") expect(d.missing).toEqual(["Vercel Preview"]);
  });

  it("タイムアウト超過で未完了なら timeout（pass にしない）", () => {
    const d = evaluateRequiredChecks(
      [check(ARTICLE_FACTORY_CHECK_NAME, "in_progress", null), PASSING[1]],
      REQUIRED_CHECKS,
      { ...OPTS, elapsedMs: 21 * 60 * 1000 }
    );
    expect(d.state).toBe("timeout");
  });

  it("実際のVercel status context（Vercel / Vercel – <project>）は合格にできる", () => {
    for (const name of ["Vercel", "Vercel – naru-career", "vercel - career-media"]) {
      const d = evaluateRequiredChecks(
        [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"), check(name, "completed", "success")],
        REQUIRED_CHECKS,
        OPTS
      );
      expect(d.state).toBe("passed");
    }
  });

  it("名前に vercel を含むだけのチェックは Vercel Preview として数えない", () => {
    // "Vercel Preview Comments" は実リポジトリに存在する Vercel App のコメント用チェック。
    // デプロイ結果ではないので、success でも Vercel Preview の合格にはしない。
    for (const name of [
      "Vercel Preview Comments",
      "vercel[bot]",
      "my-vercel-lint",
      "not-vercel",
      "Vercel Preview",
    ]) {
      const d = evaluateRequiredChecks(
        [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"), check(name, "completed", "success")],
        REQUIRED_CHECKS,
        { ...OPTS, elapsedMs: 5 * 60 * 1000 }
      );
      expect(d.state).toBe("missing");
      if (d.state === "missing") expect(d.missing).toEqual(["Vercel Preview"]);
    }
  });

  it("Vercel 以外の発行元が立てた context \"Vercel\" は合格にしない", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
        check("Vercel", "completed", "success", { origin: "some-user" }),
        check("Vercel", "completed", "success", { source: "check_run", origin: "github-actions" }),
      ],
      REQUIRED_CHECKS,
      { ...OPTS, elapsedMs: 5 * 60 * 1000 }
    );
    expect(d.state).toBe("missing");
  });

  it("検証ジョブ名の commit status や他Appの check-run は検証ジョブとして数えない", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", {
          source: "commit_status",
          origin: "someone",
        }),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { origin: "other-app" }),
        PASSING[1],
      ],
      REQUIRED_CHECKS,
      { ...OPTS, elapsedMs: 5 * 60 * 1000 }
    );
    expect(d.state).toBe("missing");
    if (d.state === "missing") expect(d.missing).toEqual([ARTICLE_FACTORY_CHECK_NAME]);
  });

  it("失敗は pending より優先される", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure"),
        check("Vercel", "pending", null),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("同じ必須チェックに該当する別チェックの片方が失敗していれば failed", () => {
    const d = evaluateRequiredChecks(
      [
        check("Vercel – naru-career", "completed", "success"),
        check("Vercel – other-project", "completed", "failure"),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });
});

// ── 再実行（同名チェックの複数試行） ──

describe("evaluateRequiredChecks — 再実行時は最新の試行だけを見る", () => {
  const VERCEL_OK = check("Vercel", "completed", "success", { observedAt: at(0) });

  it("古い failure → 最新 success なら passed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure", { id: 1, observedAt: at(1) }),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 2, observedAt: at(10) }),
        VERCEL_OK,
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("passed");
  });

  it("古い cancelled → 最新 success なら passed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "cancelled", { id: 1, observedAt: at(1) }),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 2, observedAt: at(10) }),
        VERCEL_OK,
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("passed");
  });

  it("古い pending → 最新 success なら passed（Vercel commit status）", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { observedAt: at(5) }),
        check("Vercel", "pending", null, { id: 10, observedAt: at(1) }),
        check("Vercel", "completed", "success", { id: 11, observedAt: at(3) }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("passed");
  });

  it("古い success → 最新 failure なら failed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 1, observedAt: at(1) }),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure", { id: 2, observedAt: at(10) }),
        VERCEL_OK,
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("古い success → 最新 pending なら pending（pass にしない）", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { observedAt: at(0) }),
        check("Vercel", "completed", "success", { id: 20, observedAt: at(1) }),
        check("Vercel", "pending", null, { id: 21, observedAt: at(8) }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("pending");
  });

  it("同一名チェックの rerun: 開始時刻が未設定の新しい試行も ID で最新と判定する", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 100, observedAt: at(1) }),
        check(ARTICLE_FACTORY_CHECK_NAME, "queued", null, { id: 101, observedAt: null }),
        VERCEL_OK,
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("pending");
  });

  it("同時刻なら ID の大きい方を最新とする", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 201, observedAt: at(1) }),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure", { id: 200, observedAt: at(1) }),
        VERCEL_OK,
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("passed");
  });

  it("APIの配列順に依存しない（逆順・シャッフルでも同じ結果）", () => {
    const attempts = [
      check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure", { id: 1, observedAt: at(1) }),
      check(ARTICLE_FACTORY_CHECK_NAME, "in_progress", null, { id: 2, observedAt: at(5) }),
      check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 3, observedAt: at(9) }),
      check("Vercel", "pending", null, { id: 4, observedAt: at(2) }),
      check("Vercel", "completed", "success", { id: 5, observedAt: at(6) }),
    ];
    const orders = [
      attempts,
      [...attempts].reverse(),
      [attempts[2], attempts[0], attempts[4], attempts[1], attempts[3]],
    ];
    for (const o of orders) {
      expect(evaluateRequiredChecks(o, REQUIRED_CHECKS, OPTS).state).toBe("passed");
    }
  });

  it("check-run と commit status が同じ Vercel を報告し、どちらも最新 success なら passed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
        check("Vercel", "completed", "success", { source: "commit_status", origin: "vercel[bot]" }),
        check("Vercel", "completed", "success", { source: "check_run", origin: "vercel" }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("passed");
  });

  it("check-run と commit status が競合（片方の最新が failure）なら failed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
        check("Vercel", "completed", "success", {
          source: "check_run",
          origin: "vercel",
          observedAt: at(9),
        }),
        check("Vercel", "completed", "failure", {
          source: "commit_status",
          origin: "vercel[bot]",
          observedAt: at(1),
        }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("check-run と commit status が競合（片方の最新が pending）なら pending", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
        check("Vercel", "completed", "success", { source: "check_run", origin: "vercel" }),
        check("Vercel", "pending", null, { source: "commit_status", origin: "vercel[bot]" }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("pending");
  });

  it("片方の必須チェックだけ最新 success でも、もう片方が最新 failure なら failed", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 2, observedAt: at(5) }),
        check("Vercel", "completed", "success", { id: 3, observedAt: at(1) }),
        check("Vercel", "completed", "failure", { id: 4, observedAt: at(7) }),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });
});

describe("latestPerCheck / isVercelDeploymentCheckName", () => {
  it("出どころ・発行元・名前ごとに最新1件だけを残す", () => {
    const out = latestPerCheck([
      check("Vercel", "pending", null, { id: 1, observedAt: at(1) }),
      check("Vercel", "completed", "success", { id: 2, observedAt: at(2) }),
      check("Vercel", "completed", "success", { id: 3, source: "check_run", origin: "vercel" }),
      check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure", { id: 4, observedAt: at(1) }),
      check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success", { id: 5, observedAt: at(3) }),
    ]);
    expect(out.map((c) => c.id).sort()).toEqual([2, 3, 5]);
  });

  it("Vercel のデプロイチェック名だけを認める", () => {
    expect(isVercelDeploymentCheckName("Vercel")).toBe(true);
    expect(isVercelDeploymentCheckName(" vercel ")).toBe(true);
    expect(isVercelDeploymentCheckName("Vercel – naru-career")).toBe(true);
    expect(isVercelDeploymentCheckName("Vercel Preview Comments")).toBe(false);
    expect(isVercelDeploymentCheckName("vercel[bot]")).toBe(false);
    expect(isVercelDeploymentCheckName("Vercel–")).toBe(false);
    expect(isVercelDeploymentCheckName("my-vercel")).toBe(false);
  });
});

// ── マージゲート ──

describe("evaluateMergeGate", () => {
  const passed: RequiredChecksDecision = { state: "passed", detail: "ok" };
  const pending: RequiredChecksDecision = {
    state: "pending",
    detail: "待機中",
    waitingFor: ["x"],
  };
  const failed: RequiredChecksDecision = { state: "failed", detail: "CI失敗" };

  it("QAとチェックが両方通っていればマージ可", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: passed,
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(true);
  });

  it("チェックが通っていてもQAがNGならマージしない", () => {
    const d = evaluateMergeGate({
      qaAllowed: false,
      qaReason: "QAでFAILがあります",
      checks: passed,
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("QA");
  });

  it("QAが通っていてもチェックが pending ならマージしない（再試行可）", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: pending,
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryable).toBe(true);
  });

  it("チェックが failed ならマージしない（再試行しない）", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: failed,
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryable).toBe(false);
  });

  it("missing でもマージしない", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: { state: "missing", detail: "見つかりません", missing: ["x"] },
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(false);
  });

  it("timeout でもマージしない", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: { state: "timeout", detail: "タイムアウト" },
      alreadyMerged: false,
    });
    expect(d.allowed).toBe(false);
  });

  it("既にマージ済みなら再マージしない（冪等）", () => {
    const d = evaluateMergeGate({
      qaAllowed: true,
      qaReason: "",
      checks: passed,
      alreadyMerged: true,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toContain("既にマージ済み");
      expect(d.retryable).toBe(false);
    }
  });
});

// ── 本番デプロイ ──

describe("evaluateDeployment", () => {
  const DOPTS = { elapsedMs: 60_000, timeoutMs: 20 * 60 * 1000 };
  let dseq = 5000;

  function st(
    state: DeploymentStatusRecord["state"],
    url: string | null = null,
    over: Partial<DeploymentStatusRecord> = {}
  ): DeploymentStatusRecord {
    return { id: dseq++, state, createdAt: null, environmentUrl: url, ...over };
  }

  function dep(
    statuses: DeploymentStatusRecord[],
    environment = "production",
    over: Partial<DeploymentRecord> = {}
  ): DeploymentRecord {
    return { id: dseq++, environment, createdAt: null, statuses, ...over };
  }

  it("本番デプロイ成功でURLを返す", () => {
    const d = evaluateDeployment([dep([st("success", "https://naru-career.com")])], DOPTS);
    expect(d.state).toBe("succeeded");
    if (d.state === "succeeded") expect(d.url).toBe("https://naru-career.com");
  });

  it("デプロイがまだ無ければ pending（URLを返さない）", () => {
    const d = evaluateDeployment([], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("deployment はあるが status が未登録なら pending", () => {
    const d = evaluateDeployment([dep([])], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("進行中は pending（成功扱いにしない）", () => {
    const d = evaluateDeployment([dep([st("in_progress")])], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("queued も pending", () => {
    const d = evaluateDeployment([dep([st("queued")])], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("失敗なら failed", () => {
    const d = evaluateDeployment([dep([st("failure")])], DOPTS);
    expect(d.state).toBe("failed");
  });

  it("error も failed", () => {
    const d = evaluateDeployment([dep([st("error")])], DOPTS);
    expect(d.state).toBe("failed");
  });

  it("最新 status が inactive なら公開成功にしない", () => {
    const d = evaluateDeployment(
      [dep([st("success", "https://x", { id: 1 }), st("inactive", null, { id: 2 })])],
      DOPTS
    );
    expect(d.state).toBe("failed");
  });

  it("デプロイが現れないままタイムアウトしたら timeout（成功にしない）", () => {
    const d = evaluateDeployment([], { elapsedMs: 21 * 60 * 1000, timeoutMs: 20 * 60 * 1000 });
    expect(d.state).toBe("timeout");
  });

  it("進行中のままタイムアウトしたら timeout", () => {
    const d = evaluateDeployment([dep([st("in_progress")])], {
      elapsedMs: 21 * 60 * 1000,
      timeoutMs: 20 * 60 * 1000,
    });
    expect(d.state).toBe("timeout");
  });

  it("production 環境だけで判定する（Preview の failure は無関係）", () => {
    const d = evaluateDeployment(
      [
        dep([st("failure")], "Preview"),
        dep([st("success", "https://naru-career.com")], "Production"),
      ],
      DOPTS
    );
    expect(d.state).toBe("succeeded");
  });

  it("Preview の success だけでは本番成功にしない（pending）", () => {
    const d = evaluateDeployment([dep([st("success", "https://preview.example")], "Preview")], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("Preview success + Production pending は pending（URLを返さない）", () => {
    const d = evaluateDeployment(
      [
        dep([st("success", "https://preview.example")], "Preview", { createdAt: at(9) }),
        dep([st("in_progress")], "Production", { createdAt: at(1) }),
      ],
      DOPTS
    );
    expect(d.state).toBe("pending");
  });

  it("Preview success のみのままタイムアウトしても成功にしない", () => {
    const d = evaluateDeployment([dep([st("success", "https://preview.example")], "preview")], {
      elapsedMs: 21 * 60 * 1000,
      timeoutMs: 20 * 60 * 1000,
    });
    expect(d.state).toBe("timeout");
  });

  it("environment 名の大文字小文字を正規化する", () => {
    for (const env of ["production", "Production", "PRODUCTION", " production ", "Production – career-media"]) {
      const d = evaluateDeployment([dep([st("success", "https://x")], env)], DOPTS);
      expect(d.state).toBe("succeeded");
    }
    expect(isProductionEnvironment("Preview")).toBe(false);
    expect(isProductionEnvironment("production-preview")).toBe(false);
    expect(isProductionEnvironment("Preview – production")).toBe(false);
  });

  it("古い production failure → 最新 production success なら succeeded", () => {
    const d = evaluateDeployment(
      [
        dep([st("failure")], "Production", { id: 1, createdAt: at(1) }),
        dep([st("success", "https://new")], "Production", { id: 2, createdAt: at(10) }),
      ],
      DOPTS
    );
    expect(d.state).toBe("succeeded");
    if (d.state === "succeeded") expect(d.url).toBe("https://new");
  });

  it("古い production success → 最新 production failure なら failed", () => {
    const d = evaluateDeployment(
      [
        dep([st("success", "https://old")], "Production", { id: 1, createdAt: at(1) }),
        dep([st("failure")], "Production", { id: 2, createdAt: at(10) }),
      ],
      DOPTS
    );
    expect(d.state).toBe("failed");
  });

  it("古い production success → 最新 production pending なら pending（URLを返さない）", () => {
    const d = evaluateDeployment(
      [
        dep([st("success", "https://old")], "Production", { id: 1, createdAt: at(1) }),
        dep([st("pending")], "Production", { id: 2, createdAt: at(10) }),
      ],
      DOPTS
    );
    expect(d.state).toBe("pending");
  });

  it("同一 deployment 内の古い failure + 最新 success なら succeeded", () => {
    const d = evaluateDeployment(
      [
        dep([
          st("in_progress", null, { id: 1, createdAt: at(1) }),
          st("failure", null, { id: 2, createdAt: at(2) }),
          st("success", "https://ok", { id: 3, createdAt: at(8) }),
        ]),
      ],
      DOPTS
    );
    expect(d.state).toBe("succeeded");
  });

  it("同一 deployment 内の古い success + 最新 failure なら failed", () => {
    const d = evaluateDeployment(
      [
        dep([
          st("success", "https://ok", { id: 1, createdAt: at(1) }),
          st("failure", null, { id: 2, createdAt: at(5) }),
        ]),
      ],
      DOPTS
    );
    expect(d.state).toBe("failed");
  });

  it("deployment / status が順不同で返っても最新を選ぶ", () => {
    const older = dep(
      [st("success", "https://old", { id: 11, createdAt: at(3) }), st("in_progress", null, { id: 10, createdAt: at(2) })],
      "Production",
      { id: 1, createdAt: at(1) }
    );
    const newer = dep(
      [
        st("success", "https://new", { id: 22, createdAt: at(9) }),
        st("queued", null, { id: 20, createdAt: at(6) }),
        st("failure", null, { id: 21, createdAt: at(7) }),
      ],
      "Production",
      { id: 2, createdAt: at(5) }
    );
    const preview = dep([st("failure", null, { id: 30, createdAt: at(10) })], "Preview", {
      id: 3,
      createdAt: at(10),
    });
    for (const list of [
      [older, newer, preview],
      [preview, newer, older],
      [newer, preview, older],
    ]) {
      const d = evaluateDeployment(list, DOPTS);
      expect(d.state).toBe("succeeded");
      if (d.state === "succeeded") expect(d.url).toBe("https://new");
    }
  });

  it("作成日時が同じ deployment は ID の大きい方を最新とする", () => {
    const d = evaluateDeployment(
      [
        dep([st("failure")], "Production", { id: 9, createdAt: at(1) }),
        dep([st("success", "https://ok")], "Production", { id: 8, createdAt: at(1) }),
      ],
      DOPTS
    );
    expect(d.state).toBe("failed");
  });
});

// ── ワークフロー定義との整合 ──

describe("GitHub Actions ワークフローとの整合", () => {
  /**
   * ポーリング側が待つチェック名と、実際のジョブ名がずれると
   * 「必須チェックが永遠に現れない」= 自動公開が止まる。
   * 名前の結合をテストで固定する。
   */
  it("article-factory-validation.yml のジョブ名が定数と一致する", async () => {
    const fs = await import("fs");
    const { load } = await import("js-yaml");
    const raw = fs.readFileSync(".github/workflows/article-factory-validation.yml", "utf8");
    const doc = load(raw) as {
      jobs: Record<string, { name?: string; steps: unknown[] }>;
      permissions: Record<string, string>;
      on: { pull_request: { paths: string[] } };
    };

    const job = doc.jobs[ARTICLE_FACTORY_CHECK_NAME];
    expect(job).toBeDefined();
    expect(job.name).toBe(ARTICLE_FACTORY_CHECK_NAME);
  });

  it("記事パスの変更で発火する", async () => {
    const fs = await import("fs");
    const { load } = await import("js-yaml");
    const raw = fs.readFileSync(".github/workflows/article-factory-validation.yml", "utf8");
    const doc = load(raw) as { on: { pull_request: { paths: string[] } } };

    expect(doc.on.pull_request.paths).toContain("content/articles/**");
    expect(doc.on.pull_request.paths).toContain("data/article-runs/**");
  });

  it("権限は読み取り専用である", async () => {
    const fs = await import("fs");
    const { load } = await import("js-yaml");
    const raw = fs.readFileSync(".github/workflows/article-factory-validation.yml", "utf8");
    const doc = load(raw) as { permissions: Record<string, string> };

    expect(doc.permissions).toEqual({ contents: "read" });
  });
});
