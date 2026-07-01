#!/usr/bin/env node
/**
 * Story 79-5 — Hermes cns-brain-recall plugin subprocess entry.
 * Story 82-5 — resolve npx/tsx from CNS_NODE_BIN bin dir (bare PATH safe).
 *
 * Stdout: JSON { context, citations, channel, shadow }
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathWithNodeBin, resolveTsxRunner } from "./lib/resolve-node-toolchain.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "src/brain/recall-prefetch-cli.ts");
const argv = process.argv.slice(2);

const { cmd, args, nodeBinDir } = resolveTsxRunner({ repoRoot, cliEntry, argv });

const childPath = pathWithNodeBin(process.env.PATH, nodeBinDir);

const result = spawnSync(cmd, args, {
  cwd: repoRoot,
  env: { ...process.env, PATH: childPath },
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
