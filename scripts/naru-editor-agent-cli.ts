import fs from "node:fs/promises";
import path from "node:path";
import {
  createEmptyManifest,
  evaluateRun,
  manifestPath,
  manifestToRunFacts,
  parseManifest,
  reconcileRunManifest,
  serializeManifest,
  type EditorRunEvidence,
  type EditorRunManifest,
  type RunEvaluation,
} from "../src/lib/naru-editor-agent/index";

type Command = "status" | "next" | "reconcile";

interface ParsedArgs {
  command: Command;
  date: string;
  evidencePath?: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [rawCommand, ...rest] = argv;
  if (rawCommand !== "status" && rawCommand !== "next" && rawCommand !== "reconcile") {
    fail("usage: editor-agent <status|next|reconcile> --date YYYY-MM-DD [--evidence file.json]");
  }

  let date: string | undefined;
  let evidencePath: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--date") {
      if (!rest[i + 1] || rest[i + 1].startsWith("--")) fail("--date requires YYYY-MM-DD");
      date = rest[++i];
    } else if (arg === "--evidence") {
      if (!rest[i + 1] || rest[i + 1].startsWith("--")) fail("--evidence requires a JSON file path");
      evidencePath = rest[++i];
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if (!date) fail("--date is required");
  // manifestPath performs strict calendar-date validation.
  manifestPath(date);

  if (rawCommand === "reconcile" && !evidencePath) {
    fail("reconcile requires --evidence <file.json>");
  }
  if (rawCommand !== "reconcile" && evidencePath) {
    fail("--evidence is only valid with reconcile");
  }

  return { command: rawCommand, date, evidencePath };
}

function repoDataRoot(): string {
  return process.env.NARU_EDITOR_AGENT_ROOT
    ? path.resolve(process.env.NARU_EDITOR_AGENT_ROOT)
    : process.cwd();
}

function manifestFile(root: string, date: string): string {
  return path.join(root, manifestPath(date));
}

async function readManifest(root: string, date: string): Promise<EditorRunManifest> {
  const file = manifestFile(root, date);
  try {
    return parseManifest(await fs.readFile(file, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return createEmptyManifest(date);
    throw error;
  }
}

function statusPayload(date: string, evaluation: RunEvaluation) {
  return {
    date,
    runState: evaluation.state,
    slots: Object.fromEntries(
      evaluation.slots.map((slot) => [
        String(slot.order),
        {
          state: slot.state,
          nextAction: slot.nextAction,
          humanGate: slot.humanGate,
          reasons: slot.reasons,
        },
      ]),
    ),
    pendingHumanGates: evaluation.pendingHumanGates,
    reasons: evaluation.reasons,
  };
}

function nextPayload(date: string, evaluation: RunEvaluation) {
  return {
    date,
    runState: evaluation.state,
    next: evaluation.slots.map((slot) => ({
      order: slot.order,
      nextAction: slot.nextAction,
      humanGate: slot.humanGate,
      reasons: slot.reasons,
    })),
    pendingHumanGates: evaluation.pendingHumanGates,
  };
}

async function readEvidence(filePath: string): Promise<EditorRunEvidence> {
  let raw: string;
  try {
    raw = await fs.readFile(path.resolve(filePath), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`cannot read evidence: ${message}`);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail("evidence JSON must be an object");
    }
    return parsed as EditorRunEvidence;
  } catch (error) {
    if (error instanceof Error && error.message === "evidence JSON must be an object") throw error;
    fail("evidence file is not valid JSON");
  }
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoDataRoot();
  const manifest = await readManifest(root, args.date);

  if (args.command === "status") {
    printJson(statusPayload(args.date, evaluateRun(manifestToRunFacts(manifest))));
    return;
  }

  if (args.command === "next") {
    printJson(nextPayload(args.date, evaluateRun(manifestToRunFacts(manifest))));
    return;
  }

  const evidence = await readEvidence(args.evidencePath!);
  const reconciled = reconcileRunManifest(manifest, evidence);
  const target = manifestFile(root, args.date);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, serializeManifest(reconciled), "utf8");

  const evaluation = evaluateRun(manifestToRunFacts(reconciled));
  printJson({
    ...statusPayload(args.date, evaluation),
    manifestPath: manifestPath(args.date),
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`editor-agent: ${message}\n`);
  process.exitCode = 1;
});
