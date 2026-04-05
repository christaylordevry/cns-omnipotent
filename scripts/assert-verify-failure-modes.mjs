#!/usr/bin/env node
/**
 * Story 6.3: prove `scripts/verify.sh` exits non-zero when test, lint, or typecheck fails.
 * Not part of `npm test` (would recurse into verify). Run: `npm run test:gate-failures`
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");

function runVerifyExitCode() {
  try {
    execSync("bash scripts/verify.sh", {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    return 0;
  } catch (e) {
    const status = /** @type {{ status?: number }} */ (e).status;
    if (typeof status === "number") return status;
    throw e;
  }
}

function withPatchedScripts(patch) {
  const raw = readFileSync(pkgPath, "utf8");
  try {
    const pkg = JSON.parse(raw);
    const scripts = { ...pkg.scripts };
    patch(scripts);
    pkg.scripts = scripts;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    return runVerifyExitCode();
  } finally {
    writeFileSync(pkgPath, raw);
  }
}

function assertNonZero(label, code) {
  if (code === 0) {
    console.error(`FATAL: expected verify.sh to fail (${label}), got exit 0`);
    process.exit(1);
  }
  console.error(`ok (${label}): verify.sh exited ${code}`);
}

console.error("==> assert-verify-failure-modes: three verify.sh failure paths");

assertNonZero(
  "tests",
  withPatchedScripts((s) => {
    s.test = 'node -e "process.exit(1)"';
  }),
);

assertNonZero(
  "lint",
  withPatchedScripts((s) => {
    s.lint = 'node -e "process.exit(1)"';
  }),
);

assertNonZero(
  "typecheck",
  withPatchedScripts((s) => {
    s.typecheck = 'node -e "process.exit(1)"';
  }),
);

console.error("==> assert-verify-failure-modes: all three failure modes behaved as expected");
