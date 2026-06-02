import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  enforceMemoryFileCharLimit,
  formatVaultLintMemoryLine,
  MEMORY_FILE_CHAR_LIMIT,
  patchVaultLineInMemory,
  runVaultLintMemoryUpdate,
} from "../scripts/session-close/lib/update-memory-cns-state.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const patchCliPath = join(
  root,
  "scripts/hermes-skill-examples/vault-lint/scripts/patch-memory-vault-line.mjs",
);

const FIXTURE_MEMORY = `## CNS State (auto — /session-close)
Closed: 2026-06-01T00:00:00.000Z | AGENTS v2.1.25 | failure_class: none
Epics: 57 in-progress | Tests: 100 passing
Vault: 100/100 clean — ERRORS: 0, WARNINGS: 0
Fan-out (prev): unknown

## Environment
- fixture
`;

describe("Story 57-3 vault-lint MEMORY Vault: line patch", () => {
  it("formatVaultLintMemoryLine is deterministic", () => {
    assert.equal(
      formatVaultLintMemoryLine({ notes: 115, errors: 0, lintDate: "2026-06-02" }),
      "Vault: 115 notes, ERRORS: 0, last lint: 2026-06-02",
    );
  });

  it("patchVaultLineInMemory replaces Vault: inside CNS State and preserves other rows", () => {
    const vaultLine = formatVaultLintMemoryLine({ notes: 115, errors: 2, lintDate: "2026-06-02" });
    const next = patchVaultLineInMemory(FIXTURE_MEMORY, vaultLine);

    assert.ok(next.includes("Vault: 115 notes, ERRORS: 2, last lint: 2026-06-02"));
    assert.ok(next.includes("Closed: 2026-06-01T00:00:00.000Z"));
    assert.ok(next.includes("Epics: 57 in-progress"));
    assert.ok(next.includes("Fan-out (prev): unknown"));
    assert.ok(!next.includes("100/100 clean"));
  });

  it("patchVaultLineInMemory preserves ## Environment tail", () => {
    const vaultLine = formatVaultLintMemoryLine({ notes: 1, errors: 0, lintDate: "2026-06-02" });
    const next = patchVaultLineInMemory(FIXTURE_MEMORY, vaultLine);

    assert.ok(next.includes("## Environment"));
    assert.ok(next.includes("- fixture"));
  });

  it("patchVaultLineInMemory inserts Vault: after heading when line absent", () => {
    const withoutVault = `## CNS State (auto — /session-close)
Closed: 2026-06-01T00:00:00.000Z | AGENTS v2.1.25 | failure_class: none
Epics: 57 in-progress | Tests: 100 passing
Fan-out (prev): unknown

## Environment
- fixture
`;
    const vaultLine = formatVaultLintMemoryLine({ notes: 50, errors: 1, lintDate: "2026-06-02" });
    const next = patchVaultLineInMemory(withoutVault, vaultLine);

    const lines = next.split("\n");
    const headingIdx = lines.findIndex((line) => line.startsWith("## CNS State"));
    assert.equal(lines[headingIdx + 1], vaultLine);
  });

  it("runVaultLintMemoryUpdate skips when ## CNS State heading absent", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "vault-lint-mem-no-cns-"));
    const memoryPath = join(fixtureRoot, "MEMORY.md");
    await writeFile(
      memoryPath,
      `## Environment
- only
`,
      "utf8",
    );

    try {
      const result = await runVaultLintMemoryUpdate({
        notes: 10,
        errors: 0,
        lintDate: "2026-06-02",
        memoryMdPath: memoryPath,
      });
      assert.equal(result.status, "skipped");
      assert.equal(result.message, "vault_lint_memory: skipped");
      const unchanged = await readFile(memoryPath, "utf8");
      assert.equal(unchanged, "## Environment\n- only\n");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("runVaultLintMemoryUpdate skips when MEMORY file missing", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "vault-lint-mem-missing-"));
    const memoryPath = join(fixtureRoot, "missing", "MEMORY.md");
    await mkdir(dirname(memoryPath), { recursive: true });

    try {
      const result = await runVaultLintMemoryUpdate({
        notes: 10,
        errors: 0,
        lintDate: "2026-06-02",
        memoryMdPath: memoryPath,
      });
      assert.equal(result.status, "skipped");
      await assert.rejects(() => access(memoryPath), { code: "ENOENT" });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("runVaultLintMemoryUpdate patches file and keeps size at or under 2200 bytes", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "vault-lint-mem-ok-"));
    const memoryPath = join(fixtureRoot, "MEMORY.md");
    await writeFile(memoryPath, FIXTURE_MEMORY, "utf8");

    try {
      const result = await runVaultLintMemoryUpdate({
        notes: 115,
        errors: 0,
        lintDate: "2026-06-02",
        memoryMdPath: memoryPath,
      });
      assert.equal(result.status, "ok");
      assert.ok(result.message.startsWith("vault_lint_memory: ok ("));

      const memory = await readFile(memoryPath, "utf8");
      assert.ok(memory.includes("Vault: 115 notes, ERRORS: 0, last lint: 2026-06-02"));
      assert.ok(memory.includes("Closed: 2026-06-01T00:00:00.000Z"));
      assert.ok(Buffer.byteLength(memory, "utf8") <= MEMORY_FILE_CHAR_LIMIT);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("post-patch enforceMemoryFileCharLimit keeps oversized fixture under cap", () => {
    const padding = "z".repeat(3000);
    const huge = FIXTURE_MEMORY.replace(
      "Fan-out (prev): unknown",
      `Fan-out (prev): unknown\n${padding}`,
    );
    const vaultLine = formatVaultLintMemoryLine({ notes: 115, errors: 0, lintDate: "2026-06-02" });
    const patched = patchVaultLineInMemory(huge, vaultLine);
    const capped = enforceMemoryFileCharLimit(patched, MEMORY_FILE_CHAR_LIMIT);

    assert.ok(Buffer.byteLength(capped, "utf8") <= MEMORY_FILE_CHAR_LIMIT);
    assert.ok(capped.includes("## Environment"));
  });

  it("patch-memory-vault-line.mjs exists in vault-lint skill package", () => {
    return access(patchCliPath);
  });

  it("patch-memory-vault-line.mjs exits 1 when notes env is missing", async () => {
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [patchCliPath], {
          env: { ...process.env, VAULT_LINT_NOTES: "", VAULT_LINT_DATE: "2026-06-02" },
        }),
      (err) => err.code === 1,
    );
  });

  it("patch-memory-vault-line.mjs exits 1 when lint date is invalid", async () => {
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [patchCliPath], {
          env: {
            ...process.env,
            VAULT_LINT_NOTES: "10",
            VAULT_LINT_DATE: "2026-06-02\ninjected",
          },
        }),
      (err) => err.code === 1,
    );
  });
});
