const GITHUB_API = "https://api.github.com";
const DEFAULT_REPO = "nasagame8-del/naru-career";

interface GithubRef {
  object: { sha: string };
}

interface GithubContent {
  sha: string;
  content: string;
  encoding: string;
}

interface GithubPr {
  number: number;
  html_url: string;
}

export interface DelegateInput {
  eventId: string;
  slackChannel: string;
  slackTs: string;
  userRequest: string;
  chatgptPosition: string;
  claudeInstruction: string;
}

export interface DelegateResult {
  prNumber: number;
  prUrl: string;
  branch: string;
  instructionId: string;
  reused: boolean;
}

function token(): string {
  return (
    process.env.WAR_ROOM_GITHUB_TOKEN ||
    process.env.SEO_EDITOR_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    ""
  );
}

export function githubDelegationReady(): boolean {
  return Boolean(token());
}

function repo(): string {
  return process.env.WAR_ROOM_GITHUB_REPO || DEFAULT_REPO;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = token();
  if (!auth) throw new Error("GitHub runtime token is not configured");

  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const status = response.status;
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : "";
    } catch {
      // Do not include response bodies that might contain sensitive data.
    }
    throw new Error(`GitHub API ${status} for ${path}${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function safeEventId(eventId: string): string {
  const cleaned = eventId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(0, 56) || "event";
}

export function branchForEvent(eventId: string): string {
  return `war-room/${safeEventId(eventId)}`;
}

function instructionForEvent(eventId: string): string {
  return `WAR-${safeEventId(eventId).toUpperCase()}`;
}

async function getRef(branch: string): Promise<string | null> {
  try {
    const ref = await gh<GithubRef>(
      `/repos/${repo()}/git/ref/heads/${encodeURIComponent(branch)}`
    );
    return ref.object.sha;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GitHub API 404")) return null;
    throw error;
  }
}

async function ensureBranch(branch: string): Promise<void> {
  if (await getRef(branch)) return;

  const master = await gh<GithubRef>(`/repos/${repo()}/git/ref/heads/master`);
  await gh(`/repos/${repo()}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: master.object.sha }),
  });
}

async function readContent(path: string, branch: string): Promise<GithubContent> {
  return gh<GithubContent>(
    `/repos/${repo()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`
  );
}

async function writeContent(input: {
  path: string;
  branch: string;
  content: string;
  message: string;
}): Promise<void> {
  const current = await readContent(input.path, input.branch);
  await gh(`/repos/${repo()}/contents/${encodeURI(input.path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: input.message,
      branch: input.branch,
      sha: current.sha,
      content: Buffer.from(input.content, "utf8").toString("base64"),
    }),
  });
}

async function findOpenPr(branch: string): Promise<GithubPr | null> {
  const owner = repo().split("/")[0];
  const prs = await gh<GithubPr[]>(
    `/repos/${repo()}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`
  );
  return prs[0] ?? null;
}

function buildState(branch: string, instructionId: string): string {
  return (
    JSON.stringify(
      {
        version: 5,
        repo: repo(),
        coordinationBranch: branch,
        mode: "SLACK_LIVE_WAR_ROOM",
        status: "RUN_CLAUDE",
        instructionId,
        lastCompletedInstructionId: null,
        lastReportId: null,
        iteration: 1,
        maxIterations: 2,
        maxClaudeTurns: 8,
        sameBlockerCount: 0,
        lastBlockerKey: null,
        nextWriter: "claude",
        targetBaseBranch: "master",
        autoPublishRequested: false,
        stopConditions: [
          "maxIterations reached",
          "same blocker repeated twice",
          "secret or credential input required",
          "destructive migration or deletion",
          "unsafe direct write to master",
          "production merge or deploy requires approval",
          "irreversible content decision with insufficient evidence",
        ],
        notes: "Created by NARU Slack War Room. Final merge/publish remains blocked.",
      },
      null,
      2
    ) + "\n"
  );
}

function buildInstruction(input: DelegateInput, instructionId: string): string {
  const request = input.userRequest.slice(0, 6000);
  const position = input.chatgptPosition.slice(0, 3000);
  const claude = input.claudeInstruction.slice(0, 6000);

  return `# Next Instruction

- instructionId: \`${instructionId}\`
- issuedBy: \`NARU ChatGPT / Slack War Room\`
- target: \`Claude Code\`
- status: \`ACTIVE\`
- mode: \`SLACK_LIVE_WAR_ROOM\`

## Slack trace

- eventId: \`${input.eventId}\`
- channel: \`${input.slackChannel}\`
- messageTs: \`${input.slackTs}\`

## User request

${request}

## ChatGPT initial position

${position}

## Claude assignment

${claude}

Before implementing, explicitly challenge ChatGPT's initial position:
1. state what is correct,
2. state what is risky or wrong,
3. propose the safest implementation approach.

Then make only safe, scoped changes needed for this request, run relevant tests, update \`docs/agent-handoff/REPORT.md\`, and stop.

## Hard boundaries

- Do not edit \`STATE.json\` or \`NEXT_INSTRUCTION.md\`.
- Do not push directly to master/main.
- Do not merge any PR.
- Do not deploy production.
- Do not expose or request secret values.
- Do not add or call paid external APIs.
- Preserve existing NARU article/publication/preview approval gates.
- If a destructive, credential, irreversible, or ambiguous decision is required, stop with REPORT status \`NEEDS_DECISION\`.
- Maximum workflow budget remains 8 Claude turns and 15 minutes.
`;
}

export async function delegateToClaude(input: DelegateInput): Promise<DelegateResult> {
  const branch = branchForEvent(input.eventId);
  const instructionId = instructionForEvent(input.eventId);

  await ensureBranch(branch);

  const existing = await findOpenPr(branch);
  if (existing) {
    return {
      prNumber: existing.number,
      prUrl: existing.html_url,
      branch,
      instructionId,
      reused: true,
    };
  }

  await writeContent({
    path: "docs/agent-handoff/STATE.json",
    branch,
    content: buildState(branch, instructionId),
    message: `war room: stage ${instructionId}`,
  });

  await writeContent({
    path: "docs/agent-handoff/NEXT_INSTRUCTION.md",
    branch,
    content: buildInstruction(input, instructionId),
    message: `war room: instruct ${instructionId}`,
  });

  const pr = await gh<GithubPr>(`/repos/${repo()}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `War Room: ${input.userRequest.slice(0, 72)}`,
      head: branch,
      base: "master",
      draft: true,
      body: [
        "## NARU War Room delegation",
        "",
        `- Instruction: \`${instructionId}\``,
        `- Slack event: \`${input.eventId}\``,
        "- Claude must challenge ChatGPT's proposal before implementation.",
        "- Final merge / production deploy is blocked pending ChatGPT and user review.",
      ].join("\n"),
    }),
  });

  await gh(`/repos/${repo()}/issues/${pr.number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: `@naru-autopilot ${instructionId}` }),
  });

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    branch,
    instructionId,
    reused: false,
  };
}
