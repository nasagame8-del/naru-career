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

/** チェックの出どころ */
export type CheckSource = "check_run" | "commit_status";

/**
 * check-run と commit status を同じ形に正規化したもの。
 *
 * 「最新の結果」を明示的に選ぶため、GitHub API が実際に返す
 * ID・日時・発行元をそのまま保持する（配列順には依存しない）。
 */
export interface CheckSummary {
  source: CheckSource;
  /** check_run.id / commit status の id。GitHub 上で単調増加する */
  id: number;
  /** check_run.name / commit status の context */
  name: string;
  /**
   * 発行元。check_run は app.slug（例: "github-actions", "vercel"）、
   * commit status は creator.login（例: "vercel[bot]"）。不明なら null。
   */
  origin: string | null;
  /**
   * 試行の時刻（ISO 8601）。check_run は started_at（無ければ completed_at）、
   * commit status は created_at。
   */
  observedAt: string | null;
  status: CheckStatus;
  conclusion: CheckConclusion;
}

/** 必須チェックの定義 */
export interface RequiredCheck {
  /** 表示・エラーメッセージ用のラベル */
  label: string;
  /** そのチェックに該当するか判定する（名前だけでなく発行元も見る） */
  matches: (check: CheckSummary) => boolean;
}

/** Article Factory の検証ワークフロー（.github/workflows/article-factory-validation.yml のジョブ名） */
export const ARTICLE_FACTORY_CHECK_NAME = "article-factory-validation";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeOrigin(origin: string | null): string {
  return (origin ?? "").trim().toLowerCase();
}

/**
 * Vercel のデプロイ結果を表すチェック名か。
 *
 * 実際の Vercel 連携は commit status を context "Vercel"
 * （複数プロジェクト構成では "Vercel – <project>"）で報告する。
 * 同じ Vercel App が出す "Vercel Preview Comments" はコメント機能の
 * チェックでありデプロイ結果ではないため、該当させない。
 */
export function isVercelDeploymentCheckName(name: string): boolean {
  return /^vercel(?:\s+[–—-]\s+\S.*)?$/i.test(name.trim());
}

export const REQUIRED_CHECKS: RequiredCheck[] = [
  {
    // GitHub Actions のジョブが出す check-run だけを認める。
    // 同名の commit status を任意のトークンで立てても合格にならない。
    label: ARTICLE_FACTORY_CHECK_NAME,
    matches: (c) =>
      c.source === "check_run" &&
      normalizeOrigin(c.origin) === "github-actions" &&
      normalizeName(c.name) === ARTICLE_FACTORY_CHECK_NAME,
  },
  {
    // 名前に "vercel" を含むだけでは該当させない。
    // 発行元が Vercel であり、かつデプロイ結果のチェック名であること。
    label: "Vercel Preview",
    matches: (c) =>
      isVercelDeploymentCheckName(c.name) &&
      ((c.source === "commit_status" && normalizeOrigin(c.origin) === "vercel[bot]") ||
        (c.source === "check_run" && normalizeOrigin(c.origin) === "vercel")),
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

// ── 最新の選択（配列順に依存しない） ──

function toEpoch(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * a が b より新しければ正、古ければ負。
 *
 * 両方の日時が有効で異なれば日時で比較する。
 * 同時刻、またはどちらかの日時が不明な場合は ID（GitHub 上で単調増加）で決める。
 * 日時不明の新しい試行（例: 開始前の再実行）が古い試行に負けないようにするため。
 */
export function compareRecency(
  a: { observedAt: string | null; id: number },
  b: { observedAt: string | null; id: number }
): number {
  const ta = toEpoch(a.observedAt);
  const tb = toEpoch(b.observedAt);
  if (ta !== null && tb !== null && ta !== tb) return ta > tb ? 1 : -1;
  return a.id === b.id ? 0 : a.id > b.id ? 1 : -1;
}

function pickLatest<T extends { observedAt: string | null; id: number }>(items: T[]): T | null {
  let latest: T | null = null;
  for (const it of items) {
    if (latest === null || compareRecency(it, latest) > 0) latest = it;
  }
  return latest;
}

/**
 * 同一チェック（出どころ + 発行元 + 名前）ごとに最新の試行だけを残す。
 *
 * 再実行前の failure / cancelled / pending は、より新しい試行があれば捨てる。
 * 逆に古い success があっても、最新が failure / pending ならそちらが残る。
 */
export function latestPerCheck(checks: CheckSummary[]): CheckSummary[] {
  const groups = new Map<string, CheckSummary[]>();
  for (const c of checks) {
    const key = `${c.source}\u0000${normalizeOrigin(c.origin)}\u0000${normalizeName(c.name)}`;
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  const out: CheckSummary[] = [];
  for (const g of groups.values()) {
    const latest = pickLatest(g);
    if (latest) out.push(latest);
  }
  return out;
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
 * 同名チェック（同じ出どころ・発行元・名前）が複数ある場合は
 * 日時と ID で最新の試行だけを判定対象にする（latestPerCheck）。
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

  // 再実行の古い試行を判定から外す。同一チェックは最新の1件だけを見る。
  // 別の出どころ（check-run と commit status）で同じ必須チェックに該当するものが
  // 両方ある場合は、どちらの最新も success であることを要求する（安全側）。
  const current = latestPerCheck(checks);

  for (const req of required) {
    const matched = current.filter((c) => req.matches(c));

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

/** 1件の deployment status（GitHub Deployment Statuses API） */
export interface DeploymentStatusRecord {
  /** deployment status の id（単調増加） */
  id: number;
  state: DeploymentState;
  /** created_at（ISO 8601） */
  createdAt: string | null;
  /** 本番URL（environment_url、無ければ target_url） */
  environmentUrl: string | null;
}

/** 1件の deployment とその status 履歴（GitHub Deployments API） */
export interface DeploymentRecord {
  /** deployment の id（単調増加） */
  id: number;
  /** production / Production / "Production – <project>" / preview など */
  environment: string;
  /** created_at（ISO 8601） */
  createdAt: string | null;
  /** status 履歴。API の返却順には依存しない */
  statuses: DeploymentStatusRecord[];
}

export type DeploymentDecision =
  | { state: "succeeded"; url: string | null; detail: string }
  | { state: "pending"; detail: string }
  | { state: "failed"; detail: string }
  | { state: "timeout"; detail: string };

/**
 * production 環境の deployment か。
 *
 * 大文字小文字を正規化し、Vercel の複数プロジェクト構成で使われる
 * "Production – <project>" 形式も production とみなす。
 * "Preview" などそれ以外はすべて production ではない。
 */
export function isProductionEnvironment(environment: string): boolean {
  return /^production(?:\s+[–—-]\s+\S.*)?$/i.test(environment.trim());
}

/**
 * マージコミットに紐づく本番デプロイの状態を判定する。
 *
 * 1. production 環境の deployment だけを対象にする（Preview は数えない）
 * 2. その中で最新の deployment を作成日時・ID で明示的に選ぶ
 * 3. その deployment の最新 status を作成日時・ID で明示的に選ぶ
 * 4. それが success のときだけ succeeded（URLを返す）
 *
 * 古い deployment / 古い status の failure は判定に使わない。
 * 逆に古い success があっても、最新が failure / pending なら公開成功にしない。
 * **success を確認するまで公開完了とみなさない**。
 */
export function evaluateDeployment(
  deployments: DeploymentRecord[],
  opts: { elapsedMs: number; timeoutMs: number }
): DeploymentDecision {
  const timedOut = opts.elapsedMs >= opts.timeoutMs;

  const production = deployments.filter((d) => isProductionEnvironment(d.environment));
  const latestDeployment = pickLatest(
    production.map((d) => ({ ...d, observedAt: d.createdAt }))
  );

  if (!latestDeployment) {
    if (timedOut) {
      return {
        state: "timeout",
        detail:
          "マージコミットに紐づく本番デプロイが見つからないままタイムアウトしました。公開は確認できていません",
      };
    }
    return { state: "pending", detail: "本番デプロイの開始を待っています" };
  }

  const latestStatus = pickLatest(
    latestDeployment.statuses.map((s) => ({ ...s, observedAt: s.createdAt }))
  );

  if (latestStatus?.state === "success") {
    return {
      state: "succeeded",
      url: latestStatus.environmentUrl,
      detail: "本番デプロイが成功しました",
    };
  }

  if (latestStatus?.state === "failure" || latestStatus?.state === "error") {
    return { state: "failed", detail: "本番デプロイが失敗しました。公開は完了していません" };
  }

  if (latestStatus?.state === "inactive") {
    // 最新の本番デプロイが別デプロイに置き換えられている。この deployment の
    // 成功を確認できないため、公開成功にはしない。
    return {
      state: "failed",
      detail:
        "本番デプロイが inactive（別のデプロイに置き換え済み）です。公開は確認できていません",
    };
  }

  // status 未登録 / pending / queued / in_progress
  if (timedOut) {
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
