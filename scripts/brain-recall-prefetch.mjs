#!/usr/bin/env node
/**
 * Story 79-5 — Hermes cns-brain-recall plugin subprocess entry.
 * Delegates to src/brain/recall-prefetch-cli.ts (buildRecallInjection / 79-3).
 *
 * Stdout: JSON { context, citations, channel, shadow }
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "src/brain/recall-prefetch-cli.ts");

const result = spawnSync("npx", ["tsx", cliEntry, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status === null ? 1 : result.status);
