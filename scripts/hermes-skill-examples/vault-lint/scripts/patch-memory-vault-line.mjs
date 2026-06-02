// patch-memory-vault-line.mjs — post /vault-lint MEMORY.md Vault: line patch (Story 57-3)
// Usage:
//   VAULT_LINT_NOTES=<N> VAULT_LINT_ERRORS=<X> VAULT_LINT_DATE=<YYYY-MM-DD> \
//     node patch-memory-vault-line.mjs
// Exit 0 on ok/skipped; exit 1 only on unexpected throw.

import { join } from "node:path";

const repoRoot =
  process.env.OMNIPOTENT_REPO?.trim() ||
  "/home/christ/ai-factory/projects/Omnipotent.md";

const { runVaultLintMemoryUpdate } = await import(
  join(repoRoot, "scripts/session-close/lib/update-memory-cns-state.mjs")
);

function parseCount(name, fallback) {
  const raw = process.env[name]?.trim();
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      return Math.trunc(n);
    }
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return null;
}

function parseLintDate() {
  const fromEnv = process.env.VAULT_LINT_DATE?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const positional = process.argv[3]?.trim();
  if (positional) {
    return positional;
  }
  return null;
}

function parseInputs() {
  const notes = parseCount("VAULT_LINT_NOTES", Number(process.argv[2]));
  const errors = parseCount("VAULT_LINT_ERRORS", 0);
  const lintDate = parseLintDate();
  return { notes, errors, lintDate };
}

try {
  const { notes, errors, lintDate } = parseInputs();
  if (notes === null || !lintDate) {
    process.stderr.write("patch-memory-vault-line: missing notes or lint date\n");
    process.exit(1);
  }

  const result = await runVaultLintMemoryUpdate({ notes, errors, lintDate });
  process.stdout.write(`${result.message}\n`);
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`patch-memory-vault-line: ${message}\n`);
  process.exit(1);
}
