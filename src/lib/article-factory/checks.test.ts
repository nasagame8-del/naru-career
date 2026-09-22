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
  REQUIRED_CHECKS,
  type CheckSummary,
  type DeploymentStatusSummary,
  type RequiredChecksDecision,
} from "./checks";

const OPTS = {
  elapsedMs: 60_000,
  timeoutMs: 20 * 60 * 1000,
  appearanceGraceMs: 3 * 60 * 1000,
};

function check(name: string, status: CheckSummary["status"], conclusion: CheckSummary["conclusion"]): CheckSummary {
  return { name, status, conclusion };
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

  it("Vercelのcheck名の揺れを吸収する", () => {
    for (const name of ["Vercel", "vercel[bot]", "Vercel – naru-career", "Vercel Preview Comments"]) {
      const d = evaluateRequiredChecks(
        [check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"), check(name, "completed", "success")],
        REQUIRED_CHECKS,
        OPTS
      );
      expect(d.state).toBe("passed");
    }
  });

  it("失敗は pending より優先される", () => {
    const d = evaluateRequiredChecks(
      [
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "failure"),
        check("Vercel", "in_progress", null),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
  });

  it("同名チェックが複数あり片方が失敗していれば failed", () => {
    const d = evaluateRequiredChecks(
      [
        check("Vercel", "completed", "success"),
        check("Vercel Preview", "completed", "failure"),
        check(ARTICLE_FACTORY_CHECK_NAME, "completed", "success"),
      ],
      REQUIRED_CHECKS,
      OPTS
    );
    expect(d.state).toBe("failed");
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

  function st(
    state: DeploymentStatusSummary["state"],
    url: string | null = null,
    environment = "production"
  ): DeploymentStatusSummary {
    return { state, environmentUrl: url, environment };
  }

  it("本番デプロイ成功でURLを返す", () => {
    const d = evaluateDeployment([st("success", "https://naru-career.com")], DOPTS);
    expect(d.state).toBe("succeeded");
    if (d.state === "succeeded") expect(d.url).toBe("https://naru-career.com");
  });

  it("デプロイがまだ無ければ pending（URLを返さない）", () => {
    const d = evaluateDeployment([], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("進行中は pending（成功扱いにしない）", () => {
    const d = evaluateDeployment([st("in_progress")], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("queued も pending", () => {
    const d = evaluateDeployment([st("queued")], DOPTS);
    expect(d.state).toBe("pending");
  });

  it("失敗なら failed", () => {
    const d = evaluateDeployment([st("failure")], DOPTS);
    expect(d.state).toBe("failed");
  });

  it("error も failed", () => {
    const d = evaluateDeployment([st("error")], DOPTS);
    expect(d.state).toBe("failed");
  });

  it("失敗は成功より優先される（同一コミットに両方ある場合）", () => {
    const d = evaluateDeployment([st("success", "https://x"), st("failure")], DOPTS);
    expect(d.state).toBe("failed");
  });

  it("デプロイが現れないままタイムアウトしたら timeout（成功にしない）", () => {
    const d = evaluateDeployment([], { elapsedMs: 21 * 60 * 1000, timeoutMs: 20 * 60 * 1000 });
    expect(d.state).toBe("timeout");
  });

  it("進行中のままタイムアウトしたら timeout", () => {
    const d = evaluateDeployment([st("in_progress")], {
      elapsedMs: 21 * 60 * 1000,
      timeoutMs: 20 * 60 * 1000,
    });
    expect(d.state).toBe("timeout");
  });

  it("production 環境を優先して判定する", () => {
    const d = evaluateDeployment(
      [st("failure", null, "preview"), st("success", "https://naru-career.com", "production")],
      DOPTS
    );
    expect(d.state).toBe("succeeded");
  });

  it("production が無ければ全体で判定する", () => {
    const d = evaluateDeployment([st("success", "https://preview.example", "preview")], DOPTS);
    expect(d.state).toBe("succeeded");
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
