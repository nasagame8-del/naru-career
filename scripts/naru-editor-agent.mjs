#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const callerCwd = process.cwd();
const tempDir = await mkdtemp(path.join(os.tmpdir(), "naru-editor-agent-"));

try {
  const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const compile = spawnSync(
    process.execPath,
    [
      tscBin,
      "scripts/naru-editor-agent-cli.ts",
      "--rootDir",
      repoRoot,
      "--outDir",
      tempDir,
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--esModuleInterop",
      "true",
      "--skipLibCheck",
      "true",
      "--noEmitOnError",
      "true",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (compile.status !== 0) {
    process.stderr.write(compile.stderr || compile.stdout || "editor-agent TypeScript compile failed\n");
    process.exitCode = compile.status ?? 1;
  } else {
    const cliPath = path.join(tempDir, "scripts", "naru-editor-agent-cli.js");
    const run = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
      cwd: callerCwd,
      env: process.env,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
    });
    if (run.stdout) process.stdout.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);
    process.exitCode = run.status ?? 1;
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
