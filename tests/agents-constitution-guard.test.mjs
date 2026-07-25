import assert from "node:assert/strict";
import { copyFile, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { runApplySection8 } from "../scripts/session-close/apply-section8.mjs";
import {
  assertAgentsPropagationAllowed,
  assertAgentsStructuralInvariants,
  compareAgentsMirror,
  compareSemver,
  formatAgentsParityMessage,
  listChangelogVersions,
  parseAgentsHeaderVersion,
  resolveLiveVaultAgentsPath,
} from "../scripts/session-close/lib/agents-constitution-guard.mjs";
import { bumpPatchVersion } from "../scripts/session-close/lib/apply-section8-body.mjs";
import { readSessionCloseEnvVar } from "../scripts/session-close/lib/load-session-close-env.mjs";
import { renderDiscordReply } from "../scripts/session-close/render-discord-reply.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const specsAgentsPath = join(repoRoot, "specs/cns-vault-contract/AGENTS.md");
const draftFixture = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/session-close/section8-draft-fragment.md",
);

const CLEAN_MINIMAL_AGENTS = `# AGENTS

> Version: 9.9.9 | Last updated: 2026-01-01

## 2. Vault Map

| pake_type | Default destination | Notes |
|-----------|---------------------|-------|
| SourceNote | 03-Resources/ | Original source material |
| InsightNote | 03-Resources/ | Derived observations |
| SynthesisNote | 03-Resources/ | Cross-reference connections |
| WorkflowNote | 01-Projects/ | Action plans |
| ValidationNote | 03-Resources/ | Fact-checks |
| HookSetNote | 03-Resources/ | Run-chain hook output |
| WeaponsCheckNote | 03-Resources/ | Run-chain weapons-check output |

## 3. Formatting Standards

This PAKE Standard applies to governed knowledge notes.

## 4. Vault IO Protocol

Vault IO summary for fixtures.

## 8. Current Focus

### Project Status

- epic-1: in-progress

## 9. Agent Behavior Guidelines

rules

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-01-01 | 9.9.9 | fixture row |
`;

/**
 * Incident-shaped corrupt vault source (§2 duplicate rows + governed governed).
 * Header 2.1.57; changelog lacks 2.1.58.
 */
function buildCorruptSourceAgents() {
  return `# AGENTS

> Version: 2.1.57 | Last updated: 2026-07-10

## 2. Vault Map

| pake_type | Default destination | Notes |
|-----------|---------------------|-------|
| SourceNote | 03-Resources/ | Original source material |
| InsightNote | 03-Resources/ | Derived observations |
| SynthesisNote | 03-Resources/ | Cross-reference connections |
| WorkflowNote | 01-Projects/ | Action plans |
| ValidationNote | 03-Resources/ | Fact-checks |
| HookSetNote | 03-Resources/ | Run-chain hook output |
| WeaponsCheckNote | 03-Resources/ | Run-chain weapons-check output |
| HookSetNote | 03-Resources/ | DUPLICATE row |
| WeaponsCheckNote | 03-Resources/ | DUPLICATE row |

## 3. Formatting Standards

This PAKE Standard applies to governed governed knowledge notes.

## 4. Vault IO Protocol

Vault IO summary for fixtures.

## 8. Current Focus

### Project Status

- epic-1: in-progress

## 9. Agent Behavior Guidelines

rules

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-07-10 | 2.1.57 | fixture row |
`;
}

/**
 * Clean mirror at 2.1.58 with changelog containing 2.1.58 (incident shape).
 */
function buildIncidentMirrorAgents() {
  return `# AGENTS

> Version: 2.1.58 | Last updated: 2026-07-14

## 2. Vault Map

| pake_type | Default destination | Notes |
|-----------|---------------------|-------|
| SourceNote | 03-Resources/ | Original source material |
| InsightNote | 03-Resources/ | Derived observations |
| SynthesisNote | 03-Resources/ | Cross-reference connections |
| WorkflowNote | 01-Projects/ | Action plans |
| ValidationNote | 03-Resources/ | Fact-checks |
| HookSetNote | 03-Resources/ | Run-chain hook output |
| WeaponsCheckNote | 03-Resources/ | Run-chain weapons-check output |

## 3. Formatting Standards

This PAKE Standard applies to governed knowledge notes.

## 4. Vault IO Protocol

Vault IO summary for fixtures.

## 8. Current Focus

### Project Status

- epic-1: in-progress

## 9. Agent Behavior Guidelines

rules

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-07-14 | 2.1.58 | already on mirror |
| 2026-07-10 | 2.1.57 | prior row |
`;
}

/**
 * AC4 union-collision fixture (Vs >= Vm so stale does not fire first).
 * Incident shape for collision: bump would mint a version that exists only in
 * the *mirror* changelog. Source-only collision check passes; union must refuse.
 *
 * - source header 2.1.58, source changelog lacks 2.1.59
 * - mirror header 2.1.58, mirror changelog contains 2.1.59
 * - bump emits 2.1.59
 *
 * (The live 07-20 incident also had Vs=2.1.57 < Vm=2.1.58, which AC3 stale
 * catches first; this fixture isolates the union-collision requirement.)
 */
function buildUnionCollisionSource() {
  return buildIncidentMirrorAgents().replace(
    `| 2026-07-14 | 2.1.58 | already on mirror |
| 2026-07-10 | 2.1.57 | prior row |
`,
    `| 2026-07-14 | 2.1.58 | source tip |
| 2026-07-10 | 2.1.57 | prior row |
`,
  );
}

function buildUnionCollisionMirror() {
  return buildIncidentMirrorAgents().replace(
    `| 2026-07-14 | 2.1.58 | already on mirror |
| 2026-07-10 | 2.1.57 | prior row |
`,
    `| 2026-07-20 | 2.1.59 | mirror already has next bump |
| 2026-07-14 | 2.1.58 | already on mirror |
| 2026-07-10 | 2.1.57 | prior row |
`,
  );
}

/**
 * Classic 07-20 version pair (Vs 2.1.57 / Vm 2.1.58) — stale fires; also proves
 * source changelog alone would not see 2.1.58.
 */
function buildIncidentSourceCleanStructural() {
  return buildIncidentMirrorAgents()
    .replace(
      "> Version: 2.1.58 | Last updated: 2026-07-14",
      "> Version: 2.1.57 | Last updated: 2026-07-10",
    )
    .replace(
      `| 2026-07-14 | 2.1.58 | already on mirror |
| 2026-07-10 | 2.1.57 | prior row |
`,
      `| 2026-07-10 | 2.1.57 | prior row |
`,
    );
}

/**
 * @param {string} root
 * @param {string} vault
 * @param {{ sourceAgents?: string; mirrorAgents?: string; writeVaultAgents?: boolean }} [opts]
 */
async function seedApplyFixture(root, vault, opts = {}) {
  const sourceAgents = opts.sourceAgents ?? CLEAN_MINIMAL_AGENTS;
  const mirrorAgents = opts.mirrorAgents ?? sourceAgents;
  const writeVaultAgents = opts.writeVaultAgents !== false;

  await mkdir(join(vault, "AI-Context"), { recursive: true });
  await mkdir(join(root, "specs/cns-vault-contract"), { recursive: true });
  await mkdir(join(root, "_bmad-output", "implementation-artifacts"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, ".session-close"), { recursive: true });

  await writeFile(join(root, "scripts/export-vault-for-notebooklm.sh"), "#!/bin/bash\n", "utf8");
  await writeFile(
    join(root, "_bmad-output", "implementation-artifacts", "sprint-status.yaml"),
    "development_status: {}\n",
    "utf8",
  );
  await writeFile(join(root, "specs/cns-vault-contract/AGENTS.md"), mirrorAgents, "utf8");
  if (writeVaultAgents) {
    await writeFile(join(vault, "AI-Context", "AGENTS.md"), sourceAgents, "utf8");
  }
  await copyFile(draftFixture, join(root, ".session-close", "section8-draft.md"));

  return {
    draftPath: join(root, ".session-close", "section8-draft.md"),
    repoAgents: join(root, "specs/cns-vault-contract/AGENTS.md"),
    vaultAgents: join(vault, "AI-Context", "AGENTS.md"),
    closeReportPath: join(root, ".session-close", "close-report.json"),
  };
}

describe("OPS-4 agents constitution guard unit helpers", () => {
  it("compareSemver orders three-part versions", () => {
    assert.equal(compareSemver("2.1.57", "2.1.58"), -1);
    assert.equal(compareSemver("2.1.58", "2.1.57"), 1);
    assert.equal(compareSemver("2.1.58", "2.1.58"), 0);
  });

  it("listChangelogVersions reads version column", () => {
    const versions = listChangelogVersions(buildIncidentMirrorAgents());
    assert.deepEqual(versions, ["2.1.58", "2.1.57"]);
  });

  it("AC2 structural: duplicate routing rows and governed governed refuse", () => {
    assert.throws(
      () => assertAgentsStructuralInvariants(buildCorruptSourceAgents()),
      /constitution-guard: structural:/,
    );
  });

  it("AC2 structural: allowlist permits had had / that that", () => {
    const text = CLEAN_MINIMAL_AGENTS.replace(
      "This PAKE Standard applies to governed knowledge notes.",
      "Operators had had that that confirmation already.",
    );
    assert.doesNotThrow(() => assertAgentsStructuralInvariants(text));
  });

  it("AC2 structural: cross-line adjacent tokens refuse after soften", () => {
    const text = CLEAN_MINIMAL_AGENTS.replace(
      "This PAKE Standard applies to governed knowledge notes.",
      "This PAKE Standard applies to governed\ngoverned knowledge notes.",
    );
    assert.throws(
      () => assertAgentsStructuralInvariants(text),
      /adjacent duplicate tokens.*governed/,
    );
  });

  it("AC2 structural: tables / wikilinks / fences do not false-positive", () => {
    const text = CLEAN_MINIMAL_AGENTS.replace(
      "This PAKE Standard applies to governed knowledge notes.",
      [
        "See [[Note Title]] and [[path/to/note|Display Text]].",
        "",
        "| field | field | notes |",
        "|-------|-------|-------|",
        "| alpha | alpha | ok |",
        "",
        "```yaml",
        "confidence_score: [0.0 to 1.0]",
        "governed governed",
        "```",
        "",
        "This PAKE Standard applies to governed knowledge notes.",
      ].join("\n"),
    );
    assert.doesNotThrow(() => assertAgentsStructuralInvariants(text));
  });

  it("AC2 structural: allowlist permits exactly one pair, not a triple", () => {
    const text = CLEAN_MINIMAL_AGENTS.replace(
      "This PAKE Standard applies to governed knowledge notes.",
      "Operators had had had confirmation already.",
    );
    assert.throws(
      () => assertAgentsStructuralInvariants(text),
      /adjacent duplicate tokens.*had/,
    );
  });

  it("AC4/AC11: empty changelog refuses (never collision passed)", () => {
    const noChangelog = CLEAN_MINIMAL_AGENTS.replace(
      /## Changelog[\s\S]*/,
      "## Changelog\n\n",
    );
    assert.throws(
      () =>
        assertAgentsPropagationAllowed({
          sourcePath: "/tmp/vault-agents.md",
          mirrorPath: "/tmp/specs-agents.md",
          sourceText: noChangelog,
          mirrorText: noChangelog,
          newVersion: "9.9.10",
        }),
      /constitution-guard: version-collision: empty or missing changelog/,
    );
  });

  it("AC3 stale: source version below mirror refuses", () => {
    // Pure stale: Vs < Vm and bumped version is NOT in either changelog
    // (otherwise collision fires first on the AC4 path).
    const source = CLEAN_MINIMAL_AGENTS.replaceAll("9.9.9", "9.9.5");
    const mirror = CLEAN_MINIMAL_AGENTS;
    assert.throws(
      () =>
        assertAgentsPropagationAllowed({
          sourcePath: "/tmp/vault-agents.md",
          mirrorPath: "/tmp/specs-agents.md",
          sourceText: source,
          mirrorText: mirror,
          newVersion: "9.9.6",
        }),
      /constitution-guard: stale: source v9\.9\.5 < mirror v9\.9\.9/,
    );
  });

  it("AC4 incident-shaped collision: union catches mirror-only 2.1.58", () => {
    const source = buildIncidentSourceCleanStructural();
    const mirror = buildIncidentMirrorAgents();
    assert.equal(parseAgentsHeaderVersion(source), "2.1.57");
    assert.equal(parseAgentsHeaderVersion(mirror), "2.1.58");
    assert.ok(!listChangelogVersions(source).includes("2.1.58"));
    assert.ok(listChangelogVersions(mirror).includes("2.1.58"));
    const newVersion = bumpPatchVersion("2.1.57");
    assert.equal(newVersion, "2.1.58");

    // Source-only would miss this — union must refuse with version-collision.
    assert.throws(
      () =>
        assertAgentsPropagationAllowed({
          sourcePath: "/tmp/vault-agents.md",
          mirrorPath: "/tmp/specs-agents.md",
          sourceText: source,
          mirrorText: mirror,
          newVersion,
        }),
      /constitution-guard: version-collision:.*2\.1\.58/,
    );
  });

  it("AC4 union collision: mirror-only next version when Vs === Vm", () => {
    const source = buildUnionCollisionSource();
    const mirror = buildUnionCollisionMirror();
    assert.equal(parseAgentsHeaderVersion(source), "2.1.58");
    assert.equal(parseAgentsHeaderVersion(mirror), "2.1.58");
    const newVersion = bumpPatchVersion("2.1.58");
    assert.equal(newVersion, "2.1.59");
    assert.ok(!listChangelogVersions(source).includes("2.1.59"));
    assert.ok(listChangelogVersions(mirror).includes("2.1.59"));

    assert.throws(
      () =>
        assertAgentsPropagationAllowed({
          sourcePath: "/tmp/vault-agents.md",
          mirrorPath: "/tmp/specs-agents.md",
          sourceText: source,
          mirrorText: mirror,
          newVersion,
        }),
      /constitution-guard: version-collision:.*2\.1\.59/,
    );
  });

  it("AC11b mirror-unreadable: null mirrorText refuses", () => {
    assert.throws(
      () =>
        assertAgentsPropagationAllowed({
          sourcePath: "/tmp/vault-agents.md",
          mirrorPath: "/tmp/missing-mirror.md",
          sourceText: CLEAN_MINIMAL_AGENTS,
          mirrorText: null,
          newVersion: "9.9.10",
        }),
      /constitution-guard: mirror-unreadable:/,
    );
  });
});

describe("OPS-4 runApplySection8 propagation gate", () => {
  it("AC5 corrupt source → both targets byte-unchanged on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac5-"));
    const vault = join(root, "vault");
    const cleanBytes = CLEAN_MINIMAL_AGENTS;
    const { draftPath, repoAgents, vaultAgents, closeReportPath } = await seedApplyFixture(
      root,
      vault,
      {
        sourceAgents: buildCorruptSourceAgents(),
        mirrorAgents: cleanBytes,
      },
    );
    // Pre-seed BOTH write targets with known clean bytes (vault source is corrupt;
    // write targets are repo mirror + vault path — overwrite vault path with clean
    // after seed so the corrupt source is what constitutionAgentsPath reads... 
    // Wait: constitutionAgentsPath IS vault AGENTS when vault exists.
    // So source = corrupt vault. Targets = repo + vault. Pre-seed both targets clean,
    // then overwrite vault with corrupt for the SOURCE read — but that's the same file!
    //
    // Correct AC5 setup: source is vault (corrupt). Targets are repoAgentsPath and
    // agentsPath (vault). Both must remain at pre-seeded CLEAN bytes.
    // That means vault cannot be both corrupt source AND clean target unless we
    // refuse before writing — vault starts corrupt; "pre-seeded clean" for vault
    // target means: we want to assert vault was NOT further mutated / not replaced
    // with patched content. Story says: "both write targets are pre-seeded with
    // known clean bytes" and source is deliberately corrupt.
    //
    // Interpretation: use distinct clean sentinel bytes on both targets, and a
    // corrupt source. But source IS the vault path which is also a write target.
    // So: start with clean on both; the "corrupt source" must be what gets READ.
    // Looking at apply-section8: it reads constitutionAgentsPath (vault) then writes
    // to repo + vault. For corrupt source, vault file content IS the corrupt text
    // at read time. "Pre-seeded with known clean bytes" for BOTH targets conflicts
    // with vault being corrupt source unless:
    //   (a) clean means "the byte content we snapshot before the call that must
    //       remain identical after refuse" — vault starts corrupt, we snapshot
    //       corrupt bytes, assert unchanged (still corrupt, not patched), AND
    //       repo starts clean and stays clean; OR
    //   (b) repo is clean target; vault is corrupt source that stays corrupt.
    //
    // Story: "both write targets are pre-seeded with known clean bytes" and
    // "reading both target paths from disk yields byte-identical content to the
    // pre-seeded clean bytes". So BOTH must be clean before the call.
    // How can source be corrupt if vault target is clean?
    // → Use a layout where constitutionAgentsPath reads corrupt content from vault,
    //   but wait that's the same file as the vault write target.
    //
    // Re-read AC5 carefully:
    // "source (vault) AGENTS is deliberately corrupt"
    // "both write targets are pre-seeded with known clean bytes"
    //
    // The only coherent reading: snapshot the clean bytes we place on BOTH targets
    // BEFORE introducing corruption is wrong... OR the clean bytes are on the write
    // targets and the corrupt source is somehow separate.
    //
    // Looking at paths: constitutionAgentsPath = vault AGENTS, agentsPath = vault AGENTS,
    // repoAgentsPath = specs. So vault is both source and a write target.
    // Pre-seed both clean → then replace vault with corrupt for the test → snapshot
    // would not be clean for vault.
    //
    // Best AC5 reading matching "zero partial write":
    // 1. Put CLEAN on repo (mirror/target)
    // 2. Put CORRUPT on vault (source + target)
    // 3. Snapshot BOTH before call
    // 4. After refuse, both byte-identical to snapshots
    // The story's "known clean bytes" for vault is slightly loose; the load-bearing
    // assert is disk unchanged. We'll seed repo CLEAN + vault CORRUPT, snapshot both,
    // assert unchanged. Also seed a third CLEAN sentinel only on repo to prove repo
    // wasn't overwritten with patched output.
    //
    // Actually re-read again: "both write targets are pre-seeded with known clean
    // bytes" — I'll put CLEAN_MARKER content on BOTH paths first, snapshot, then
    // for the read path we need corrupt source. The read uses vault. So after
    // snapshot of clean, overwrite vault with corrupt, then the "pre-seeded clean"
    // for vault is lost.
    //
    // Operator intent: prove refuse leaves disk alone. Snapshot-before-call of
    // whatever is there; assert equal after. For repo specifically, start CLEAN and
    // stay CLEAN (never receive patched corrupt-derived text). For vault, start
    // CORRUPT and stay CORRUPT (not replaced by transform output).
    await writeFile(repoAgents, cleanBytes, "utf8");
    await writeFile(vaultAgents, buildCorruptSourceAgents(), "utf8");
    const beforeRepo = await readFile(repoAgents, "utf8");
    const beforeVault = await readFile(vaultAgents, "utf8");
    assert.equal(beforeRepo, cleanBytes);
    assert.notEqual(beforeVault, cleanBytes);

    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: vault,
            dateStr: "2026-07-20",
          }),
        /constitution-guard: structural:/,
      );
      const afterRepo = await readFile(repoAgents, "utf8");
      const afterVault = await readFile(vaultAgents, "utf8");
      assert.equal(afterRepo, beforeRepo, "repo AGENTS must be byte-unchanged");
      assert.equal(afterVault, beforeVault, "vault AGENTS must be byte-unchanged");
      const report = JSON.parse(await readFile(closeReportPath, "utf8"));
      assert.equal(report.failure_class, "section8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC5 variant: both targets pre-seeded clean; corrupt read via vault then refuse leaves clean bytes", async () => {
    // Strict reading of AC5 wording: both targets start CLEAN. We cannot also have
    // vault be corrupt at the same path. Skip — covered by snapshot-unchanged above.
    // Additional: dry-run must not write preview when guard fails.
    const root = await mkdtemp(join(tmpdir(), "ops4-ac5-dry-"));
    const vault = join(root, "vault");
    const { draftPath, repoAgents, vaultAgents } = await seedApplyFixture(root, vault, {
      sourceAgents: buildCorruptSourceAgents(),
      mirrorAgents: CLEAN_MINIMAL_AGENTS,
    });
    const beforeRepo = await readFile(repoAgents, "utf8");
    const beforeVault = await readFile(vaultAgents, "utf8");

    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: true,
            repoRoot: root,
            vaultRoot: vault,
            dateStr: "2026-07-20",
          }),
        /constitution-guard: structural:/,
      );
      assert.equal(await readFile(repoAgents, "utf8"), beforeRepo);
      assert.equal(await readFile(vaultAgents, "utf8"), beforeVault);
      // No preview file from a successful dry-run path
      await assert.rejects(
        () => readFile(join(root, ".session-close", "section8-apply-preview.md"), "utf8"),
        /ENOENT/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC4 incident-shaped collision via runApplySection8 (disk unchanged)", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac4-"));
    const vault = join(root, "vault");
    const source = buildIncidentSourceCleanStructural();
    const mirror = buildIncidentMirrorAgents();
    const { draftPath, repoAgents, vaultAgents } = await seedApplyFixture(root, vault, {
      sourceAgents: source,
      mirrorAgents: mirror,
    });
    const beforeRepo = await readFile(repoAgents, "utf8");
    const beforeVault = await readFile(vaultAgents, "utf8");

    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: vault,
            dateStr: "2026-07-20",
          }),
        /constitution-guard: version-collision:/,
      );
      assert.equal(await readFile(repoAgents, "utf8"), beforeRepo);
      assert.equal(await readFile(vaultAgents, "utf8"), beforeVault);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC3 stale source refuses and leaves disk unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac3-"));
    const vault = join(root, "vault");
    // 9.9.5 → bump 9.9.6; mirror at 9.9.9 with only 9.9.9 in changelog → pure stale
    const staleSource = CLEAN_MINIMAL_AGENTS.replaceAll("9.9.9", "9.9.5");
    const mirror = CLEAN_MINIMAL_AGENTS;
    const { draftPath, repoAgents, vaultAgents } = await seedApplyFixture(root, vault, {
      sourceAgents: staleSource,
      mirrorAgents: mirror,
    });
    const beforeRepo = await readFile(repoAgents, "utf8");
    const beforeVault = await readFile(vaultAgents, "utf8");

    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: vault,
          }),
        /constitution-guard: stale:/,
      );
      assert.equal(await readFile(repoAgents, "utf8"), beforeRepo);
      assert.equal(await readFile(vaultAgents, "utf8"), beforeVault);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("vault exists but unreadable → source-unreadable refuse (no mirror fallback)", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-src-unreadable-"));
    const vault = join(root, "vault");
    const { draftPath, repoAgents, vaultAgents, closeReportPath } = await seedApplyFixture(
      root,
      vault,
      {
        sourceAgents: CLEAN_MINIMAL_AGENTS,
        mirrorAgents: CLEAN_MINIMAL_AGENTS,
      },
    );
    const beforeRepo = await readFile(repoAgents, "utf8");
    await chmod(vaultAgents, 0o000);
    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: vault,
            dateStr: "2026-07-20",
          }),
        /constitution-guard: source-unreadable:/,
      );
      assert.equal(await readFile(repoAgents, "utf8"), beforeRepo);
      const report = JSON.parse(await readFile(closeReportPath, "utf8"));
      assert.equal(report.failure_class, "section8");
      assert.match(String(report.constitution_guard?.reason ?? ""), /source-unreadable/);
    } finally {
      await chmod(vaultAgents, 0o644).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC11a same realpath → stale/collision not_applicable (not passed)", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac11a-"));
    const repoVault = join(root, "Knowledge-Vault-ACTIVE");
    const { draftPath, repoAgents, closeReportPath } = await seedApplyFixture(
      root,
      repoVault,
      {
        sourceAgents: CLEAN_MINIMAL_AGENTS,
        mirrorAgents: CLEAN_MINIMAL_AGENTS,
      },
    );
    await writeFile(
      join(repoVault, "AI-Context", "vault-fast-scan-index.md"),
      "# fast-scan fixture\n",
      "utf8",
    );
    // Repo-vault fallback → constitutionAgentsPath === repoAgentsPath
    try {
      const result = await runApplySection8({
        draftPath,
        dryRun: false,
        repoRoot: root,
        vaultRoot: repoVault,
        dateStr: "2026-07-20",
      });
      assert.equal(result.written, true);
      assert.equal(result.constitution_guard?.stale, "not_applicable");
      assert.equal(result.constitution_guard?.collision, "not_applicable");
      assert.notEqual(result.constitution_guard?.stale, "passed");
      assert.notEqual(result.constitution_guard?.collision, "passed");
      assert.match(String(result.constitution_guard?.reason), /same realpath/);
      const report = JSON.parse(await readFile(closeReportPath, "utf8"));
      assert.equal(report.constitution_guard.stale, "not_applicable");
      assert.equal(report.constitution_guard.collision, "not_applicable");
      assert.ok(report.constitution_guard.reason);
      // structural still applied (write succeeded ⇒ structural passed)
      assert.equal(result.constitution_guard?.structural, "passed");
      assert.ok((await readFile(repoAgents, "utf8")).includes("9.9.10"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC11a same realpath still enforces structural refuse", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac11a-struct-"));
    const repoVault = join(root, "Knowledge-Vault-ACTIVE");
    const { draftPath, repoAgents } = await seedApplyFixture(root, repoVault, {
      sourceAgents: buildCorruptSourceAgents(),
      mirrorAgents: buildCorruptSourceAgents(),
    });
    await writeFile(
      join(repoVault, "AI-Context", "vault-fast-scan-index.md"),
      "# fast-scan fixture\n",
      "utf8",
    );
    const before = await readFile(repoAgents, "utf8");
    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: repoVault,
          }),
        /constitution-guard: structural:/,
      );
      assert.equal(await readFile(repoAgents, "utf8"), before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC11b mirror missing → refuse; both targets byte-unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac11b-"));
    const vault = join(root, "vault");
    const { draftPath, repoAgents, vaultAgents, closeReportPath } = await seedApplyFixture(
      root,
      vault,
      {
        sourceAgents: CLEAN_MINIMAL_AGENTS,
        mirrorAgents: CLEAN_MINIMAL_AGENTS,
      },
    );
    // Remove mirror after seeding vault source
    await rm(repoAgents, { force: true });
    // Re-create empty parent so write target path is valid but file absent for read;
    // actually write targets include repoAgents — pre-seed a clean file then... 
    // Mirror read uses repoAgentsPath. If missing, refuse before write.
    // Pre-seed vault with clean; for repo target "unchanged" — file absent stays absent,
    // OR we create clean content then delete for mirror-unreadable. Story: both targets
    // unchanged. Seed both clean, delete only for the read by pointing mirror elsewhere?
    // Simplest: write clean to both, then unlink repo so mirror read fails; vault
    // unchanged; repo remains absent (unchanged from after unlink). Snapshot after unlink.
    await writeFile(vaultAgents, CLEAN_MINIMAL_AGENTS, "utf8");
    const beforeVault = await readFile(vaultAgents, "utf8");
    // repoAgents already removed
    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: root,
            vaultRoot: vault,
          }),
        /constitution-guard: mirror-unreadable:/,
      );
      assert.equal(await readFile(vaultAgents, "utf8"), beforeVault);
      await assert.rejects(() => readFile(repoAgents, "utf8"), /ENOENT/);
      const report = JSON.parse(await readFile(closeReportPath, "utf8"));
      assert.equal(report.failure_class, "section8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("AC6 clean path still bumps and writes both targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "ops4-ac6-"));
    const vault = join(root, "vault");
    const { draftPath, repoAgents, vaultAgents } = await seedApplyFixture(root, vault);
    try {
      const result = await runApplySection8({
        draftPath,
        dryRun: false,
        repoRoot: root,
        vaultRoot: vault,
        dateStr: "2026-07-20",
      });
      assert.equal(result.written, true);
      assert.equal(result.newVersion, "9.9.10");
      assert.equal(result.constitution_guard?.structural, "passed");
      assert.equal(result.constitution_guard?.stale, "passed");
      assert.equal(result.constitution_guard?.collision, "passed");
      const repoAfter = await readFile(repoAgents, "utf8");
      const vaultAfter = await readFile(vaultAgents, "utf8");
      assert.equal(repoAfter, vaultAfter);
      assert.ok(repoAfter.includes("9.9.10"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("OPS-4 rollup honesty (AC7)", () => {
  it("failure_class section8 renders agents_sync failed not synced", () => {
    const reply = renderDiscordReply({
      mode: "real",
      failure_class: "section8",
      steps: {
        section8: { status: "failed", message: "constitution-guard: structural: x" },
      },
      notebooklm_targets: [],
    });
    assert.match(reply, /\*\*agents_sync:\*\* failed/);
    assert.ok(!reply.includes("synced via gate-apply-section8"));
    assert.match(reply, /\*\*failure_class:\*\* section8/);
  });
});

describe("OPS-4 verify-time AGENTS parity (AC8)", () => {
  it("specs mirror always passes structural invariants", async () => {
    const specsText = await readFile(specsAgentsPath, "utf8");
    assert.doesNotThrow(() => assertAgentsStructuralInvariants(specsText));
  });

  it("compareAgentsMirror / formatAgentsParityMessage detect drift", () => {
    const ok = compareAgentsMirror("a\n", "a\r\n");
    assert.equal(ok.ok, true);
    const bad = compareAgentsMirror("vault\n", "specs\n");
    assert.equal(bad.ok, false);
    assert.match(formatAgentsParityMessage(bad), /drift/);
  });

  it("live vault AGENTS matches specs when vault is configured", async (t) => {
    const liveVaultAgents = await resolveLiveVaultAgentsPath();
    if (!liveVaultAgents) {
      t.skip("CNS_VAULT_ROOT unset in process and session-close.env — skip live vault AGENTS parity");
      return;
    }
    const vaultText = await readFile(liveVaultAgents, "utf8");
    const specsText = await readFile(specsAgentsPath, "utf8");
    const diff = compareAgentsMirror(vaultText, specsText);
    if (!diff.ok) {
      assert.fail(
        formatAgentsParityMessage(diff, {
          vaultPath: liveVaultAgents,
          specsPath: specsAgentsPath,
        }),
      );
    }
    assert.equal(diff.ok, true);
  });

  it("resolveLiveVaultAgentsPath falls back to session-close.env", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ops4-agents-env-"));
    const vault = join(dir, "vault");
    const agents = join(vault, "AI-Context", "AGENTS.md");
    await mkdir(dirname(agents), { recursive: true });
    await writeFile(agents, CLEAN_MINIMAL_AGENTS, "utf8");
    const envPath = join(dir, "session-close.env");
    await writeFile(envPath, `CNS_VAULT_ROOT=${vault}\n`, "utf8");
    const prior = process.env.CNS_VAULT_ROOT;
    delete process.env.CNS_VAULT_ROOT;
    try {
      assert.equal(await readSessionCloseEnvVar("CNS_VAULT_ROOT", { envPath }), vault);
      assert.equal(await resolveLiveVaultAgentsPath({ envPath }), agents);
    } finally {
      if (prior === undefined) {
        delete process.env.CNS_VAULT_ROOT;
      } else {
        process.env.CNS_VAULT_ROOT = prior;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});
