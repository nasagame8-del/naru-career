/**
 * Article Factory の GitHub 連携。
 *
 * SEO Editor と同じ原則:
 *   反映経路は「専用branch → commit → Pull Request」の一本のみ。
 *   master を含むベースブランチへの直接pushは実装しない。
 *   Token はサーバー側でのみ扱い、レスポンスにもログにも出さない。
 *
 * 追加の原則（新規記事オートパイロット固有）:
 *   - 同じ runId に対して冪等。再実行しても同じbranch/PRを返す。
 *   - 既存slugの記事は絶対に上書きしない。
 *   - 書き込みパスは safety.isAllowedPath のみ。
 */

import { BRANCH_PREFIX, GITHUB_BASE_BRANCH, GITHUB_REPO, LIMITS } from "./config";
import { isAllowedPath } from "./safety";
import type { CheckSummary, DeploymentStatusSummary } from "./checks";
import type { ArticleChange, PublishResult, QaResult, SelectedTopic } from "./types";

const API = "https://api.github.com";

export class ArticleGithubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ArticleGithubError";
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.SEO_EDITOR_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new ArticleGithubError(
      500,
      "GitHub Tokenが未設定です（SEO_EDITOR_GITHUB_TOKEN または GITHUB_TOKEN）"
    );
  }
  return token;
}

/** 設定の事前チェック（secretは返さない） */
export function githubReadiness(): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!process.env.SEO_EDITOR_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
    reasons.push("GitHub Tokenが未設定です（SEO_EDITOR_GITHUB_TOKEN / GITHUB_TOKEN）");
  }
  if (!GITHUB_BASE_BRANCH) {
    reasons.push("SEO_EDITOR_BASE_BRANCH が未設定です。PRのベースブランチを明示してください");
  }
  if (!GITHUB_REPO.includes("/")) {
    reasons.push("SEO_EDITOR_GITHUB_REPO の形式が owner/repo ではありません");
  }
  return { ready: reasons.length === 0, reasons };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ?? "";
    } catch {
      /* ignore */
    }
    // Tokenがメッセージへ混入しないよう path と status だけを出す
    throw new ArticleGithubError(
      res.status,
      `GitHub API ${res.status} (${path})${detail ? `: ${detail}` : ""}`
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function toBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
}

/**
 * runId から決まる branch 名。冪等性の基礎になる。
 *
 * git の ref 名は `..` や空白を含められないため、
 * 英数字・アンダースコア・ハイフン以外はすべてハイフンに畳む。
 */
export function branchNameForRun(runId: string): string {
  const safe = runId
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${BRANCH_PREFIX}/${safe || "run"}`;
}

/** 指定パスが対象branchに既に存在するか */
export async function fileExistsOnBranch(path: string, branch: string): Promise<boolean> {
  const repo = GITHUB_REPO;
  try {
    await gh<unknown>(
      `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`
    );
    return true;
  } catch (e) {
    if (e instanceof ArticleGithubError && e.status === 404) return false;
    throw e;
  }
}

/** 対象branchのファイル内容を読む。無ければ null */
export async function readFileFromBranch(path: string, branch: string): Promise<string | null> {
  const repo = GITHUB_REPO;
  try {
    const res = await gh<{ content: string; encoding: string }>(
      `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`
    );
    if (res.encoding !== "base64") return null;
    return Buffer.from(res.content, "base64").toString("utf-8");
  } catch (e) {
    if (e instanceof ArticleGithubError && e.status === 404) return null;
    throw e;
  }
}

/** 単一ファイルを対象branchへ書き込む（候補バッチの永続化に使う） */
export async function writeFileToBranch(opts: {
  path: string;
  branch: string;
  content: string;
  message: string;
}): Promise<void> {
  if (!isAllowedPath(opts.path)) {
    throw new ArticleGithubError(400, `許可されていない書き込みパスです: ${opts.path}`);
  }
  const repo = GITHUB_REPO;

  // branch が無ければベースから作る
  await ensureBranch(opts.branch);

  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(
      `/repos/${repo}/contents/${encodeURI(opts.path)}?ref=${encodeURIComponent(opts.branch)}`
    );
    sha = existing.sha;
  } catch (e) {
    if (!(e instanceof ArticleGithubError && e.status === 404)) throw e;
  }

  await gh(`/repos/${repo}/contents/${encodeURI(opts.path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: opts.message,
      content: toBase64(opts.content),
      branch: opts.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

/** branch が無ければベースブランチから作成する */
async function ensureBranch(branch: string): Promise<string> {
  const repo = GITHUB_REPO;
  try {
    const ref = await gh<{ object: { sha: string } }>(
      `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
    );
    return ref.object.sha;
  } catch (e) {
    if (!(e instanceof ArticleGithubError && e.status === 404)) throw e;
  }

  const baseRef = await gh<{ object: { sha: string } }>(
    `/repos/${repo}/git/ref/heads/${encodeURIComponent(GITHUB_BASE_BRANCH)}`
  );
  await gh(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
  });
  return baseRef.object.sha;
}

/** 既に同じbranchから開いているPRがあれば返す（冪等性） */
async function findOpenPr(
  branch: string
): Promise<{ number: number; html_url: string } | null> {
  const repo = GITHUB_REPO;
  const owner = repo.split("/")[0];
  const prs = await gh<{ number: number; html_url: string }[]>(
    `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`
  );
  return prs.length > 0 ? prs[0] : null;
}

export interface CreateArticlePrOptions {
  runId: string;
  topic: SelectedTopic;
  changes: ArticleChange[];
  qa: QaResult;
  /** 自動公開が許可されなかった理由（null なら許可された） */
  publishBlockedReason: string | null;
}

/**
 * 記事一式を新規branchへコミットし、master に対してPRを開く。
 *
 * 冪等: 同じ runId で再実行した場合、既存branch/PRを返して二重作成しない。
 */
export async function createArticlePullRequest(
  opts: CreateArticlePrOptions
): Promise<PublishResult> {
  const readiness = githubReadiness();
  if (!readiness.ready) {
    throw new ArticleGithubError(400, readiness.reasons.join(" / "));
  }

  if (opts.changes.length === 0) {
    throw new ArticleGithubError(400, "反映する変更がありません");
  }
  if (opts.changes.length > LIMITS.maxChanges) {
    throw new ArticleGithubError(
      400,
      `変更ファイル数が上限（${LIMITS.maxChanges}）を超えています`
    );
  }

  // パス検証は必ずここでもう一度行う（QAを通過していても再検証する）
  for (const c of opts.changes) {
    if (!isAllowedPath(c.path)) {
      throw new ArticleGithubError(400, `許可されていない変更パスです: ${c.path}`);
    }
  }

  const base = GITHUB_BASE_BRANCH;
  const repo = GITHUB_REPO;
  const branch = branchNameForRun(opts.runId);

  // ── 冪等性: 既にPRがあればそれを返す ──
  const existingPr = await findOpenPr(branch);
  if (existingPr) {
    return {
      branch,
      prNumber: existingPr.number,
      prUrl: existingPr.html_url,
      headSha: null,
      mergeCommitSha: null,
      published: false,
      publishBlockedReason:
        opts.publishBlockedReason ?? "このrunIdのPRは既に作成済みです（冪等実行）",
      productionUrl: null,
    };
  }

  // ── ベースブランチの現在地 ──
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`
  );
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${baseSha}`);

  // ── 既存記事の上書きを拒否 ──
  for (const c of opts.changes) {
    if (!c.path.startsWith("content/articles/")) continue;
    if (await fileExistsOnBranch(c.path, base)) {
      throw new ArticleGithubError(
        409,
        `既に存在する記事を上書きしようとしました: ${c.path}。新規記事オートパイロットは上書きを行いません`
      );
    }
  }

  // ── blob → tree → commit → branch ──
  const entries: TreeEntry[] = [];
  for (const c of opts.changes) {
    const blob = await gh<{ sha: string }>(`/repos/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: toBase64(c.content), encoding: "base64" }),
    });
    entries.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await gh<{ sha: string }>(`/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
  });

  const commit = await gh<{ sha: string }>(`/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `article: ${opts.topic.title}（Article Factory ${opts.runId}）`,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });

  await gh(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });

  const pr = await gh<{ number: number; html_url: string }>(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `新規記事: ${opts.topic.title}`,
      head: branch,
      base,
      body: buildPrBody(opts),
      draft: false,
    }),
  });

  return {
    branch,
    prNumber: pr.number,
    prUrl: pr.html_url,
    headSha: commit.sha,
    mergeCommitSha: null,
    published: false,
    publishBlockedReason: opts.publishBlockedReason,
    productionUrl: null,
  };
}

// ── PRの状態取得（CIゲート用） ──

export interface PullRequestState {
  number: number;
  /** PR head のコミットSHA。チェックはこのSHAに対して登録される */
  headSha: string;
  merged: boolean;
  /** マージ済みの場合のマージコミットSHA */
  mergeCommitSha: string | null;
  state: "open" | "closed";
}

/** PRの現在の状態を取得する（head SHA・マージ済みか） */
export async function getPullRequestState(prNumber: number): Promise<PullRequestState> {
  const repo = GITHUB_REPO;
  const pr = await gh<{
    number: number;
    head: { sha: string };
    merged: boolean;
    merge_commit_sha: string | null;
    state: "open" | "closed";
  }>(`/repos/${repo}/pulls/${prNumber}`);

  return {
    number: pr.number,
    headSha: pr.head.sha,
    merged: pr.merged,
    mergeCommitSha: pr.merge_commit_sha,
    state: pr.state,
  };
}

/**
 * 指定SHAに紐づくチェックを取得する。
 *
 * GitHub Actions は check-runs、Vercel などの連携は commit status として
 * 報告されることがあるため、**両方**を取得して同じ形へ正規化する。
 */
export async function getChecksForSha(sha: string): Promise<CheckSummary[]> {
  const repo = GITHUB_REPO;
  const out: CheckSummary[] = [];

  const runs = await gh<{
    check_runs: { name: string; status: string; conclusion: string | null }[];
  }>(`/repos/${repo}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`);

  for (const r of runs.check_runs ?? []) {
    out.push({
      name: r.name,
      status: r.status as CheckSummary["status"],
      conclusion: r.conclusion as CheckSummary["conclusion"],
    });
  }

  const statuses = await gh<{
    statuses: { context: string; state: string }[];
  }>(`/repos/${repo}/commits/${encodeURIComponent(sha)}/status?per_page=100`);

  for (const s of statuses.statuses ?? []) {
    // commit status の state を check-run の形へ正規化する
    const state = s.state;
    out.push({
      name: s.context,
      status: state === "pending" ? "pending" : "completed",
      conclusion:
        state === "success"
          ? "success"
          : state === "failure" || state === "error"
            ? "failure"
            : null,
    });
  }

  return out;
}

/**
 * 自動公開（PRマージ）。
 *
 * 呼び出し側で QA と必須チェックの**両方**が通った場合にのみ実行すること。
 * この関数自体は判断せず、与えられた指示を実行する。
 *
 * @returns マージコミットのSHA（本番デプロイの確認に使う）
 */
export async function mergeArticlePullRequest(prNumber: number): Promise<string> {
  const repo = GITHUB_REPO;

  // 冪等性: 既にマージ済みならそのマージコミットSHAを返す
  const current = await getPullRequestState(prNumber);
  if (current.merged && current.mergeCommitSha) return current.mergeCommitSha;

  const res = await gh<{ merged: boolean; sha: string }>(
    `/repos/${repo}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      body: JSON.stringify({ merge_method: "squash" }),
    }
  );

  if (!res.merged || !res.sha) {
    throw new ArticleGithubError(500, "マージは実行されましたがマージコミットSHAを取得できませんでした");
  }
  return res.sha;
}

/**
 * マージコミットに紐づくデプロイの状態を取得する。
 *
 * Vercel の Git 連携が有効な場合、GitHub の Deployments API に
 * production 環境のデプロイとステータスが登録される。
 */
export async function getDeploymentStatusesForSha(
  sha: string
): Promise<DeploymentStatusSummary[]> {
  const repo = GITHUB_REPO;

  const deployments = await gh<
    { id: number; environment: string }[]
  >(`/repos/${repo}/deployments?sha=${encodeURIComponent(sha)}&per_page=50`);

  const out: DeploymentStatusSummary[] = [];

  for (const d of deployments ?? []) {
    const statuses = await gh<
      { state: string; environment_url?: string | null; target_url?: string | null }[]
    >(`/repos/${repo}/deployments/${d.id}/statuses?per_page=50`);

    for (const s of statuses ?? []) {
      out.push({
        state: s.state as DeploymentStatusSummary["state"],
        environmentUrl: s.environment_url || s.target_url || null,
        environment: d.environment,
      });
    }
  }

  return out;
}

function buildPrBody(opts: CreateArticlePrOptions): string {
  const lines: string[] = [
    "## 新規記事（Article Factory）",
    "",
    `- runId: \`${opts.runId}\``,
    `- slug: \`${opts.topic.slug}\``,
    `- 主要キーワード: ${opts.topic.primaryKeyword}`,
    `- 検索意図: ${opts.topic.searchIntent}`,
    `- カテゴリ: ${opts.topic.category}`,
    `- 記事ID（リポジトリ在庫からの提案値）: ${opts.topic.articleId}`,
    "",
    "### 既存記事との差分",
    "",
    opts.topic.differenceFromExisting,
    "",
    "### いま書く理由",
    "",
    opts.topic.reasonToWriteNow,
    "",
    "### QA",
    "",
    `- 総合判定: **${opts.qa.overall}**`,
    `- 指摘件数: ${opts.qa.issues.length}`,
  ];

  if (opts.qa.issues.length > 0) {
    lines.push("");
    for (const i of opts.qa.issues.slice(0, 20)) {
      lines.push(`- \`${i.verdict}\` ${i.category} — ${i.target}: ${i.message}`);
    }
  }

  lines.push("", "### 変更ファイル", "");
  for (const c of opts.changes) lines.push(`- \`${c.path}\` — ${c.operation}`);

  lines.push("", "### 自動公開", "");
  lines.push(
    opts.publishBlockedReason
      ? `自動公開は行われていません — ${opts.publishBlockedReason}`
      : "すべてのゲートを通過したため自動公開の対象です。"
  );

  lines.push(
    "",
    "### 画像",
    "",
    "画像は自動生成していません。`image-plan.md` を確認し、承認済みの既存画像のみを実装してください。"
  );

  return lines.join("\n");
}
