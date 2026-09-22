/**
 * 外部CIチェックと本番デプロイの判定。
 *
 * ここにある関数はすべて純粋関数で、GitHub APIの呼び出しは含まない。
 * 「合格したか / まだ待つか / 失敗か」の判断を一箇所に集め、テストで固定する。
 *
 * 原則:
 *   - pending は pass ではない。待つ。
 *   - 必須チェックが現れない（missing）のは合格ではない。ブロックする。
 *   - タイムアウトはブロックであって合格ではない。
 *   - ローカルのbooleanだけでマージ可否を決めない。
 */

// ── チェックの正規化 ──

export type CheckConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "skipped"
  | "stale"
  | null;

export type CheckStatus = "queued" | "in_progress" | "completed" | "waiting" | "pending";

/** check-run と commit status を同じ形に正規化したもの */
export interface CheckSummary {
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion;
}

/** 必須チェックの定義 */
export interface RequiredCheck {
  /** 表示・エラーメッセージ用のラベル */
  label: string;
  /** そのチェックに該当するか判定する */
  matches: (name: string) => boolean;
}

/** Article Factory の検証ワークフロー（.github/workflows/article-factory-validation.yml のジョブ名） */
export const ARTICLE_FACTORY_CHECK_NAME = "article-factory-validation";

export const REQUIRED_CHECKS: RequiredCheck[] = [
  {
    label: ARTICLE_FACTORY_CHECK_NAME,
    matches: (name) => name.trim().toLowerCase() === ARTICLE_FACTORY_CHECK_NAME,
  },
  {
    // Vercel の check 名は "Vercel" / "Vercel – <project>" / "vercel[bot]" など揺れる
    label: "Vercel Preview",
    matches: (name) => /vercel/i.test(name),
  },
];

/** 合格とみなす conclusion。neutral / skipped は合格にしない（安全側） */
function isSuccess(c: CheckConclusion): boolean {
  return c === "success";
}

/** 明確な失敗とみなす conclusion */
function isFailure(c: CheckConclusion): boolean {
  return (
    c === "failure" || c === "cancelled" || c === "timed_out" || c === "action_required" ||
    c === "stale"
  );
}

function isCompleted(s: CheckStatus): boolean {
  return s === "completed";
}

// ── 必須チェックの判定 ──

export type RequiredChecksDecision =
  | { state: "passed"; detail: string }
  | { state: "pending"; detail: string; waitingFor: string[] }
  | { state: "failed"; detail: string }
  | { state: "missing"; detail: string; missing: string[] }
  | { state: "timeout"; detail: string };

export interface EvaluateChecksOptions {
  /** ワークフローが待ち始めてからの経過ミリ秒 */
  elapsedMs: number;
  /** これを超えたら timeout */
  timeoutMs: number;
  /**
   * チェックが出現するまでの猶予。
   * CIの登録には時間がかかるため、この間は missing ではなく pending 扱いにする。
   */
  appearanceGraceMs: number;
}

/**
 * 必須チェックの状態を判定する。
 *
 * 判定順序（安全側から）:
 *   1. 必須チェックのどれかが失敗している → failed
 *   2. 猶予を過ぎても現れない必須チェックがある → missing
 *   3. まだ完了していない必須チェックがある → pending
 *   4. タイムアウト超過 → timeout
 *   5. すべて success → passed
 */
export function evaluateRequiredChecks(
  checks: CheckSummary[],
  required: RequiredCheck[],
  opts: EvaluateChecksOptions
): RequiredChecksDecision {
  const failures: string[] = [];
  const missing: string[] = [];
  const waitingFor: string[] = [];

  for (const req of required) {
    const matched = checks.filter((c) => req.matches(c.name));

    if (matched.length === 0) {
      // 猶予内なら「まだ登録されていない」とみなして待つ
      if (opts.elapsedMs < opts.appearanceGraceMs) {
        waitingFor.push(`${req.label}（未登録）`);
      } else {
        missing.push(req.label);
      }
      continue;
    }

    const failed = matched.filter((c) => isCompleted(c.status) && isFailure(c.conclusion));
    if (failed.length > 0) {
      failures.push(
        `${req.label}: ${failed.map((f) => `${f.name}=${f.conclusion}`).join(", ")}`
      );
      continue;
    }

    const incomplete = matched.filter((c) => !isCompleted(c.status));
    if (incomplete.length > 0) {
      waitingFor.push(`${req.label}（${incomplete.map((c) => c.status).join(",")}）`);
      continue;
    }

    // 完了しているが success でないもの（neutral / skipped など）は合格にしない
    const notSuccess = matched.filter((c) => !isSuccess(c.conclusion));
    if (notSuccess.length > 0) {
      failures.push(
        `${req.label}: ${notSuccess
          .map((c) => `${c.name}=${c.conclusion ?? "none"}`)
          .join(", ")}（successではありません）`
      );
    }
  }

  if (failures.length > 0) {
    return { state: "failed", detail: `必須チェックが失敗しました — ${failures.join(" / ")}` };
  }
  if (missing.length > 0) {
    return {
      state: "missing",
      detail: `必須チェックが見つかりません — ${missing.join(" / ")}。CIまたはVercel連携が有効か確認してください`,
      missing,
    };
  }
  if (waitingFor.length > 0) {
    if (opts.elapsedMs >= opts.timeoutMs) {
      return {
        state: "timeout",
        detail: `必須チェックの完了を待ちましたがタイムアウトしました — 未完了: ${waitingFor.join(" / ")}`,
      };
    }
    return {
      state: "pending",
      detail: `必須チェックの完了を待っています — ${waitingFor.join(" / ")}`,
      waitingFor,
    };
  }

  return { state: "passed", detail: "必須チェックはすべて成功しました" };
}

// ── 本番デプロイの判定 ──

export type DeploymentState =
  | "success"
  | "failure"
  | "error"
  | "pending"
  | "queued"
  | "in_progress"
  | "inactive";

export interface DeploymentStatusSummary {
  state: DeploymentState;
  /** 本番URL（成功時に入る） */
  environmentUrl: string | null;
  /** production / preview など */
  environment: string;
}

export type DeploymentDecision =
  | { state: "succeeded"; url: string | null; detail: string }
  | { state: "pending"; detail: string }
  | { state: "failed"; detail: string }
  | { state: "timeout"; detail: string };

/**
 * マージコミットに紐づく本番デプロイの状態を判定する。
 *
 * **success を確認するまで公開完了とみなさない**。
 * pending のまま打ち切った場合も「公開した」とは報告しない。
 */
export function evaluateDeployment(
  statuses: DeploymentStatusSummary[],
  opts: { elapsedMs: number; timeoutMs: number }
): DeploymentDecision {
  const production = statuses.filter(
    (s) => s.environment === "production" || s.environment === "Production"
  );
  const relevant = production.length > 0 ? production : statuses;

  if (relevant.length === 0) {
    if (opts.elapsedMs >= opts.timeoutMs) {
      return {
        state: "timeout",
        detail:
          "マージコミットに紐づく本番デプロイが見つからないままタイムアウトしました。公開は確認できていません",
      };
    }
    return { state: "pending", detail: "本番デプロイの開始を待っています" };
  }

  if (relevant.some((s) => s.state === "failure" || s.state === "error")) {
    return { state: "failed", detail: "本番デプロイが失敗しました。公開は完了していません" };
  }

  const succeeded = relevant.find((s) => s.state === "success");
  if (succeeded) {
    return {
      state: "succeeded",
      url: succeeded.environmentUrl,
      detail: "本番デプロイが成功しました",
    };
  }

  if (opts.elapsedMs >= opts.timeoutMs) {
    return {
      state: "timeout",
      detail: "本番デプロイの完了を待ちましたがタイムアウトしました。公開は確認できていません",
    };
  }
  return { state: "pending", detail: "本番デプロイの完了を待っています" };
}

// ── マージ可否 ──

export interface MergeGateInput {
  /** QAの自動公開判定（canAutoPublish の結果） */
  qaAllowed: boolean;
  qaReason: string;
  /** 必須チェックの判定 */
  checks: RequiredChecksDecision;
  /** 既にマージ済みか（冪等性） */
  alreadyMerged: boolean;
}

export type MergeGateDecision =
  | { allowed: true; reason: "" }
  | { allowed: false; reason: string; retryable: boolean };

/**
 * マージしてよいかの最終判定。
 *
 * QAとCIの**両方**が通っていなければマージしない。
 * pending は retryable（もう一度待つ）、それ以外は retryable でない。
 */
export function evaluateMergeGate(input: MergeGateInput): MergeGateDecision {
  if (input.alreadyMerged) {
    return { allowed: false, reason: "このPRは既にマージ済みです", retryable: false };
  }
  if (!input.qaAllowed) {
    return { allowed: false, reason: input.qaReason, retryable: false };
  }
  switch (input.checks.state) {
    case "passed":
      return { allowed: true, reason: "" };
    case "pending":
      return { allowed: false, reason: input.checks.detail, retryable: true };
    default:
      return { allowed: false, reason: input.checks.detail, retryable: false };
  }
}
