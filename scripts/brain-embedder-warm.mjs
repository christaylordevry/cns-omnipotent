#!/usr/bin/env node
/**
 * Story 82-6 — periodic Portal embedder warm ping (Hermes subscription proxy).
 * Stdout: none; stderr logs skip/warm status; exit 0 when disabled or proxy down.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathWithNodeBin, resolveTsxRunner } from "./lib/resolve-node-toolchain.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "src/brain/embedder-warm-cli.ts");

const { cmd, args, nodeBinDir } = resolveTsxRunner({ repoRoot, cliEntry, argv: [] });
const childPath = pathWithNodeBin(process.env.PATH, nodeBinDir);

const result = spawnSync(cmd, args, {
  cwd: repoRoot,
  env: { ...process.env, PATH: childPath },
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status === null ? 1 : result.status);
