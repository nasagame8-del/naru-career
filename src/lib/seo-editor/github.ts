/**
 * GitHub 連携。
 *
 * 反映経路は「専用branch → commit → Pull Request」の一本のみ。
 * main / master を含むベースブランチへの直接pushは実装しない。
 *
 * Token はサーバー側環境変数でのみ扱い、レスポンスにもログにも出さない。
 */

import { GITHUB_BASE_BRANCH, GITHUB_REPO, SEO_RUN_DIR } from "./config";
import type { ArticleChange, SeoPublishResult, SeoRun } from "@/types/seo-editor";

const API = "https://api.github.com";

export class GithubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.SEO_EDITOR_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new GithubError(
      500,
      "GitHub Tokenが未設定です（SEO_EDITOR_GITHUB_TOKEN または GITHUB_TOKEN）"
    );
  }
  return token;
}

/** 設定の事前チェック。UIの表示制御にも使う（secretは返さない） */
export function githubReadiness(): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!process.env.SEO_EDITOR_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
    reasons.push("GitHub Tokenが未設定です（SEO_EDITOR_GITHUB_TOKEN / GITHUB_TOKEN）");
  }
  if (!GITHUB_BASE_BRANCH) {
    reasons.push(
      "SEO_EDITOR_BASE_BRANCH が未設定です。PRのベースブランチを明示的に設定してください"
    );
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
    // Tokenがエラーメッセージへ混入しないよう、pathとstatusだけを出す
    throw new GithubError(res.status, `GitHub API ${res.status} (${path})${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

function toBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

/** 変更セットが書き込めるパスかを検証する（想定外の場所を触らせない） */
export function assertSafePath(path: string): void {
  const allowed =
    /^content\/articles\/[\w-]+\.md$/.test(path) ||
    new RegExp(`^${SEO_RUN_DIR}/[\\w.-]+\\.json$`).test(path);
  if (!allowed) throw new GithubError(400, `許可されていない変更パスです: ${path}`);
  if (path.includes("..")) throw new GithubError(400, `不正なパスです: ${path}`);
}

export interface PublishOptions {
  run: SeoRun;
  changes: ArticleChange[];
  /** VercelのGit連携状況に関する注記（Previewが出ない件） */
  previewNote: string | null;
}

export async function publishAsPullRequest(opts: PublishOptions): Promise<SeoPublishResult> {
  const readiness = githubReadiness();
  if (!readiness.ready) {
    throw new GithubError(400, readiness.reasons.join(" / "));
  }

  const base = GITHUB_BASE_BRANCH;
  const repo = GITHUB_REPO;
  const branch = `seo-editor/${opts.run.id}`;

  // ── ベースブランチの現在地 ──
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`
  );
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${baseSha}`);

  // ── blob作成 ──
  const entries: TreeEntry[] = [];
  for (const change of opts.changes) {
    assertSafePath(change.path);
    if (change.operation === "DELETE") {
      entries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await gh<{ sha: string }>(`/repos/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: toBase64(change.after), encoding: "base64" }),
    });
    entries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // ── SeoRun をPRに同梱して永続化する（Vercelのローカルファイルは使わない） ──
  const runPath = `${SEO_RUN_DIR}/${opts.run.id}.json`;
  assertSafePath(runPath);
  const runBlob = await gh<{ sha: string }>(`/repos/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({
      content: toBase64(JSON.stringify(serializeRun(opts.run), null, 2) + "\n"),
      encoding: "base64",
    }),
  });
  entries.push({ path: runPath, mode: "100644", type: "blob", sha: runBlob.sha });

  // ── tree → commit → branch ──
  const tree = await gh<{ sha: string }>(`/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
  });

  const topic = opts.run.selectedTopic?.topic ?? "SEO改善";
  const commit = await gh<{ sha: string }>(`/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `seo: ${topic}（SEO Editor ${opts.run.id}）`,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });

  await gh(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });

  // ── Pull Request ──
  const pr = await gh<{ number: number; html_url: string }>(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `SEO Editor: ${topic}`,
      head: branch,
      base,
      body: buildPrBody(opts),
      draft: false,
    }),
  });

  return {
    branch,
    commitSha: commit.sha,
    prNumber: pr.number,
    prUrl: pr.html_url,
    baseBranch: base,
    createdAt: new Date().toISOString(),
    previewNote: opts.previewNote,
  };
}

/** PRに載せるRunの形。巨大な before/after 本文は落とす */
function serializeRun(run: SeoRun) {
  return {
    ...run,
    changes: run.changes.map((c) => ({
      path: c.path,
      operation: c.operation,
      reason: c.reason,
      phase: c.phase,
      preservedSegments: c.preservedSegments,
      lostSegments: c.lostSegments,
      needsHumanDecision: c.needsHumanDecision,
      note: c.note,
      beforeChars: c.before?.length ?? 0,
      afterChars: c.after.length,
    })),
  };
}

function buildPrBody(opts: PublishOptions): string {
  const run = opts.run;
  const qa = run.qa;
  const counts = {
    create: opts.changes.filter((c) => c.operation === "CREATE").length,
    update: opts.changes.filter((c) => c.operation === "UPDATE").length,
    links: run.internalLinks?.links.filter((l) => l.operation === "ADD").length ?? 0,
    removed: run.internalLinks?.links.filter((l) => l.operation === "REMOVE").length ?? 0,
  };

  const lines: string[] = [
    `## SEO Editor 実行結果`,
    "",
    `- Run ID: \`${run.id}\``,
    `- テーマ: **${run.selectedTopic?.topic ?? "-"}**（${run.selectedTopic?.type ?? "-"} / 確度 ${run.selectedTopic?.dataConfidence ?? "-"}）`,
    `- 新規記事: ${counts.create} / リライト・更新: ${counts.update} / 内部リンク追加: ${counts.links} / 削除: ${counts.removed}`,
    `- QA: **${qa?.overall ?? "未実行"}** — ${qa?.summary ?? ""}`,
    "",
    `### 編集方針`,
    "",
    run.actionDecision?.summary ?? "-",
    "",
    `### 変更ファイル`,
    "",
    ...opts.changes.map((c) => `- \`${c.path}\` — ${c.operation}${c.needsHumanDecision ? " ⚠️ 要人間判断" : ""}`),
  ];

  const needsDecision = opts.changes.filter((c) => c.needsHumanDecision);
  if (needsDecision.length > 0) {
    lines.push("", "### 人間の判断が必要な項目", "");
    for (const c of needsDecision) lines.push(`- \`${c.path}\`: ${c.note}`);
  }

  if (qa && qa.issues.length > 0) {
    lines.push("", "### QA所見", "");
    for (const issue of qa.issues.slice(0, 30)) {
      lines.push(`- **${issue.verdict}** [${issue.category}] \`${issue.target}\` — ${issue.message}`);
    }
    if (qa.issues.length > 30) lines.push(`- …ほか${qa.issues.length - 30}件`);
  }

  if (run.warnings.length > 0) {
    lines.push("", "### 警告", "");
    for (const w of run.warnings.slice(0, 20)) lines.push(`- ${w}`);
  }

  if (run.research.length > 0) {
    lines.push("", "### 外部調査の出典", "");
    for (const s of run.research) lines.push(`- [${s.title}](${s.url}) — 取得 ${s.retrievedAt}（${s.usedFor}）`);
  }

  if (opts.previewNote) lines.push("", `> ${opts.previewNote}`);

  lines.push(
    "",
    "---",
    "",
    "このPRは NARU SEO Editor が生成しました。**マージは人間が判断してください。**",
    `実行記録: \`${SEO_RUN_DIR}/${run.id}.json\``
  );

  return lines.join("\n");
}
