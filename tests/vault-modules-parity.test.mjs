import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { promisify } from "node:util";

import {
  compareVaultModulesMirror,
  formatModulesParityMessage,
  listModuleFiles,
  normalizeLf,
  resolveLiveVaultModulesDir,
  runSyncVaultModules,
} from "../scripts/session-close/lib/sync-vault-modules.mjs";
import { readSessionCloseEnvVar } from "../scripts/session-close/lib/load-session-close-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const specsModulesDir = join(repoRoot, "specs/cns-vault-contract/modules");

/**
 * @param {string} root
 * @param {string} vault
 * @param {string} specs
 * @param {Record<string, string>} vaultFiles
 * @param {Record<string, string>} [specsFiles]
 */
async function seedModulesFixture(root, vault, specs, vaultFiles, specsFiles = {}) {
  const vaultModules = join(vault, "AI-Context", "modules");
  const specsModules = join(specs, "modules");
  await mkdir(vaultModules, { recursive: true });
  await mkdir(specsModules, { recursive: true });
  await mkdir(join(root, "_bmad-output", "implementation-artifacts"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(join(root, "scripts/export-vault-for-notebooklm.sh"), "#!/bin/bash\n", "utf8");
  await writeFile(
    join(root, "_bmad-output", "implementation-artifacts", "sprint-status.yaml"),
    "development_status: {}\n",
    "utf8",
  );
  for (const [name, body] of Object.entries(vaultFiles)) {
    await writeFile(join(vaultModules, name), body, "utf8");
  }
  for (const [name, body] of Object.entries(specsFiles)) {
    await writeFile(join(specsModules, name), body, "utf8");
  }
  return { vaultModules, specsModules, repoRoot: root };
}

describe("sync-vault-modules lib", () => {
  it("normalizeLf converts CRLF to LF", () => {
    assert.equal(normalizeLf("a\r\nb"), "a\nb");
    assert.equal(normalizeLf("a\nb"), "a\nb");
  });

  it("compareVaultModulesMirror detects added, removed, and changed files", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-modules-compare-"));
    const vault = join(root, "vault");
    const specs = join(root, "repo", "specs/cns-vault-contract");
    const { vaultModules, specsModules } = await seedModulesFixture(
      join(root, "repo"),
      vault,
      specs,
      { "alpha.md": "vault alpha\n", "beta.md": "shared\n" },
      { "beta.md": "stale\n", "gamma.md": "specs only\n" },
    );

    try {
      const diff = await compareVaultModulesMirror(vaultModules, specsModules);
      assert.equal(diff.ok, false);
      assert.deepEqual(diff.added, ["alpha.md"]);
      assert.deepEqual(diff.removed, ["gamma.md"]);
      assert.deepEqual(diff.changed, ["beta.md"]);
      assert.match(formatModulesParityMessage(diff), /npm run sync-vault-modules/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runSyncVaultModules dry-run previews without writing", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-modules-dry-"));
    const vault = join(root, "vault");
    const specs = join(root, "repo", "specs/cns-vault-contract");
    const { vaultModules, specsModules } = await seedModulesFixture(
      join(root, "repo"),
      vault,
      specs,
      { "one.md": "vault content\n" },
      { "one.md": "old content\n" },
    );

    try {
      const preview = await runSyncVaultModules({
        dryRun: true,
        repoRoot: join(root, "repo"),
        vaultRoot: vault,
      });
      assert.equal(preview.dryRun, true);
      assert.equal(preview.ok, false);
      assert.deepEqual(preview.changed ?? preview.updated, ["one.md"]);

      const onDisk = await readFile(join(specsModules, "one.md"), "utf8");
      assert.equal(onDisk, "old content\n");

      const after = await runSyncVaultModules({
        dryRun: false,
        repoRoot: join(root, "repo"),
        vaultRoot: vault,
      });
      assert.equal(after.dryRun, false);
      const synced = await readFile(join(specsModules, "one.md"), "utf8");
      assert.equal(synced, "vault content\n");

      const parity = await compareVaultModulesMirror(vaultModules, specsModules);
      assert.equal(parity.ok, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runSyncVaultModules removes specs-only files and normalizes CRLF on write", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-modules-sync-"));
    const vault = join(root, "vault");
    const specs = join(root, "repo", "specs/cns-vault-contract");
    const { vaultModules, specsModules } = await seedModulesFixture(
      join(root, "repo"),
      vault,
      specs,
      { "keep.md": "line one\r\nline two\r\n" },
      { "keep.md": "stale\n", "orphan.md": "remove me\n" },
    );

    try {
      await runSyncVaultModules({
        dryRun: false,
        repoRoot: join(root, "repo"),
        vaultRoot: vault,
      });
      const files = await listModuleFiles(specsModules);
      assert.deepEqual(files, ["keep.md"]);
      const body = await readFile(join(specsModules, "keep.md"), "utf8");
      assert.equal(body, "line one\nline two\n");
      assert.equal(existsSync(join(specsModules, "orphan.md")), false);

      const parity = await compareVaultModulesMirror(vaultModules, specsModules);
      assert.equal(parity.ok, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("sync-vault-modules CLI supports --dry-run", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-modules-cli-"));
    const vault = join(root, "vault");
    const repo = join(root, "repo");
    const { specsModules } = await seedModulesFixture(
      repo,
      vault,
      join(repo, "specs/cns-vault-contract"),
      { "cli.md": "from vault\n" },
      { "cli.md": "from vault\n" },
    );

    try {
      const { stdout } = await execFileAsync(
        "node",
        [join(repoRoot, "scripts/session-close/sync-vault-modules.mjs"), "--dry-run"],
        {
          env: {
            ...process.env,
            OMNIPOTENT_REPO: repo,
            CNS_VAULT_ROOT: vault,
          },
        },
      );
      assert.match(stdout, /in sync|dry-run/);
      const onDisk = await readFile(join(specsModules, "cli.md"), "utf8");
      assert.equal(onDisk, "from vault\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Story 87-2 vault modules parity gate", () => {
  it("resolveLiveVaultModulesDir falls back to session-close.env when process env unset", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vault-modules-env-fallback-"));
    const vault = join(dir, "vault");
    const modules = join(vault, "AI-Context", "modules");
    await mkdir(modules, { recursive: true });
    await writeFile(join(modules, "probe.md"), "# probe\n", "utf8");
    const envPath = join(dir, "session-close.env");
    await writeFile(envPath, `CNS_VAULT_ROOT=${vault}\n`, "utf8");

    const prior = process.env.CNS_VAULT_ROOT;
    delete process.env.CNS_VAULT_ROOT;
    try {
      assert.equal(await readSessionCloseEnvVar("CNS_VAULT_ROOT", { envPath }), vault);
      assert.equal(await resolveLiveVaultModulesDir({ envPath }), modules);
    } finally {
      if (prior === undefined) {
        delete process.env.CNS_VAULT_ROOT;
      } else {
        process.env.CNS_VAULT_ROOT = prior;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("live vault modules mirror matches specs when vault is configured", async (t) => {
    const liveVaultModules = await resolveLiveVaultModulesDir();
    if (!liveVaultModules) {
      t.skip("CNS_VAULT_ROOT unset in process and session-close.env — skip live vault parity");
      return;
    }
    const diff = await compareVaultModulesMirror(liveVaultModules, specsModulesDir);
    if (!diff.ok) {
      assert.fail(formatModulesParityMessage(diff));
    }
    assert.equal(diff.ok, true);
  });
});
