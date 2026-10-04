import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "naru-editor-agent.mjs");

function run(root, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: { ...process.env, NARU_EDITOR_AGENT_ROOT: root },
    encoding: "utf8",
  });
}

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "naru-editor-agent-test-"));
}

test("status and next are safe on a missing manifest", async () => {
  const root = await tempRoot();
  try {
    const status = run(root, ["status", "--date", "2026-10-05"]);
    assert.equal(status.status, 0, status.stderr);
    const parsed = JSON.parse(status.stdout);
    assert.equal(parsed.runState, "CANDIDATE_RESEARCH_PENDING");
    assert.equal(parsed.slots["1"].humanGate, "selection");
    assert.equal(fs.existsSync(path.join(root, "data", "editor-agent", "run-2026-10-05.json")), false);

    const next = run(root, ["next", "--date", "2026-10-05"]);
    assert.equal(next.status, 0, next.stderr);
    const nextParsed = JSON.parse(next.stdout);
    assert.equal(nextParsed.next.length, 2);
    assert.equal(nextParsed.next[0].nextAction, "wait-for-selection");
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("reconcile writes a manifest and is semantically idempotent", async () => {
  const root = await tempRoot();
  try {
    const evidencePath = path.join(root, "evidence.json");
    await fsp.writeFile(
      evidencePath,
      JSON.stringify({
        candidatesReady: true,
        slots: {
          "1": {
            selected: true,
            candidateId: "cand-1",
            articleId: "60",
            slug: "example-article",
          },
        },
      }),
    );

    const first = run(root, ["reconcile", "--date", "2026-10-05", "--evidence", evidencePath]);
    assert.equal(first.status, 0, first.stderr);
    const manifestPath = path.join(root, "data", "editor-agent", "run-2026-10-05.json");
    const once = await fsp.readFile(manifestPath, "utf8");

    const second = run(root, ["reconcile", "--date", "2026-10-05", "--evidence", evidencePath]);
    assert.equal(second.status, 0, second.stderr);
    const twice = await fsp.readFile(manifestPath, "utf8");
    assert.equal(twice, once);

    const status = run(root, ["status", "--date", "2026-10-05"]);
    assert.equal(status.status, 0, status.stderr);
    const parsed = JSON.parse(status.stdout);
    assert.equal(parsed.runState, "ACTIVE");
    assert.equal(parsed.slots["1"].state, "SELECTED");
    assert.equal(parsed.slots["2"].state, "UNSELECTED");
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("invalid date, evidence, and unknown commands fail closed", async () => {
  const root = await tempRoot();
  try {
    const badDate = run(root, ["status", "--date", "2026-02-30"]);
    assert.notEqual(badDate.status, 0);
    assert.match(badDate.stderr, /invalid calendar date/);

    const missing = run(root, ["reconcile", "--date", "2026-10-05", "--evidence", path.join(root, "missing.json")]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /cannot read evidence/);

    const invalidPath = path.join(root, "invalid.json");
    await fsp.writeFile(invalidPath, "{ nope");
    const invalid = run(root, ["reconcile", "--date", "2026-10-05", "--evidence", invalidPath]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /not valid JSON/);

    const unknown = run(root, ["publish", "--date", "2026-10-05"]);
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /usage:/);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
