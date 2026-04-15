#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadRuntimeConfig } from "../config.js";
import {
  assertOutputDirOutsideVault,
  runBuildIndex,
  writeBuildIndexArtifact,
} from "./build-index.js";
import { StubEmbedder } from "./embedder.js";
import { loadBrainCorpusAllowlistFromVault } from "./load-corpus-allowlist.js";
import {
  BRAIN_INDEX_MANIFEST_SCHEMA_VERSION,
  type BrainIndexManifest,
  type BrainIndexManifestAllowlistSnapshot,
  allowlistToSnapshot,
  buildBoundedFailureSummaries,
  buildCounts,
  buildExclusionReasonBreakdown,
  computeVaultSnapshotAndFreshness,
  failureToManifestFailure,
  writeBrainIndexManifest,
} from "./brain-index-manifest.js";

function buildFailedManifest(params: {
  buildTimestampMs: number;
  allowlistSnapshot: BrainIndexManifestAllowlistSnapshot;
  failureCode: string;
  failureMessage: string;
  embedder: StubEmbedder["metadata"];
  drift: Awaited<ReturnType<typeof computeVaultSnapshotAndFreshness>>;
}): BrainIndexManifest {
  return {
    schema_version: BRAIN_INDEX_MANIFEST_SCHEMA_VERSION,
    outcome: "failed",
    build_timestamp_utc: new Date(params.buildTimestampMs).toISOString(),
    allowlist_snapshot: params.allowlistSnapshot,
    embedder: params.embedder,
    counts: { candidates_discovered: 0, embedded: 0, excluded: 0, failed: 0 },
    exclusion_reason_breakdown: {},
    failures: [],
    vault_snapshot: params.drift.vault_snapshot,
    freshness: params.drift.freshness,
    failure: {
      code: params.failureCode,
      message: params.failureMessage,
    },
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "output-dir": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(
      [
        "brain:index — one-shot Brain index build (Story 12.4).",
        "",
        "Usage: tsx src/brain/build-index-cli.ts --output-dir <abs-path>",
        "",
        "Requires CNS_VAULT_ROOT. Allowlist: <vault>/_meta/schemas/brain-corpus-allowlist.json",
        "",
      ].join("\n"),
    );
    return;
  }

  const outDir = values["output-dir"];
  if (!outDir || outDir.trim().length === 0) {
    process.stderr.write("Error: --output-dir <abs-path> is required.\n");
    process.exitCode = 1;
    return;
  }

  const cfg = await loadRuntimeConfig();
  const vaultRoot = cfg.vaultRoot;

  const safeOutputDir = await assertOutputDirOutsideVault(vaultRoot, outDir);
  const buildTimestampMs = Date.now();

  const loaded = await loadBrainCorpusAllowlistFromVault(vaultRoot);
  if (!loaded.ok) {
    process.stderr.write("Invalid brain corpus allowlist. Fix _meta/schemas/brain-corpus-allowlist.json.\n");
    const failure = failureToManifestFailure(new Error("Invalid brain corpus allowlist."));
    const drift = await computeVaultSnapshotAndFreshness(vaultRoot, [], buildTimestampMs);
    const manifest = buildFailedManifest({
      buildTimestampMs,
      allowlistSnapshot: { subtrees: [], inbox: { enabled: false } },
      failureCode: "ALLOWLIST_INVALID",
      failureMessage: String(failure.message).split("\n")[0] ?? "Invalid allowlist",
      embedder: new StubEmbedder().metadata,
      drift,
    });
    try {
      await writeBrainIndexManifest(vaultRoot, safeOutputDir, manifest);
    } catch {
      // best effort; still exit non-zero
    }
    process.exitCode = 1;
    return;
  }

  const embedder = new StubEmbedder();
  let artifactWritten = false;
  try {
    const run = await runBuildIndex(vaultRoot, loaded.value, embedder);
    const written = await writeBuildIndexArtifact(vaultRoot, safeOutputDir, run.result);
    artifactWritten = true;

    const drift = await computeVaultSnapshotAndFreshness(vaultRoot, run.candidates, buildTimestampMs);
    const breakdown = buildExclusionReasonBreakdown(run.result.exclusions, run.hardExcludedMetaLogsCount);
    const counts = buildCounts(run.candidates.length, run.result.records.length, run.result.exclusions);
    const failures = buildBoundedFailureSummaries(run.result.exclusions);

    const manifest: BrainIndexManifest = {
      schema_version: BRAIN_INDEX_MANIFEST_SCHEMA_VERSION,
      outcome: "success",
      build_timestamp_utc: new Date(buildTimestampMs).toISOString(),
      allowlist_snapshot: allowlistToSnapshot(loaded.value),
      embedder: run.result.embedder,
      counts,
      exclusion_reason_breakdown: breakdown,
      failures,
      vault_snapshot: drift.vault_snapshot,
      freshness: drift.freshness,
    };
    const mPath = await writeBrainIndexManifest(vaultRoot, safeOutputDir, manifest);
    process.stdout.write(`Wrote ${written}\n`);
    process.stdout.write(`Wrote ${mPath}\n`);
  } catch (err) {
    if (artifactWritten) {
      throw err;
    }
    const failure = failureToManifestFailure(err);
    const drift = await computeVaultSnapshotAndFreshness(vaultRoot, [], buildTimestampMs);
    const manifest = buildFailedManifest({
      buildTimestampMs,
      allowlistSnapshot: allowlistToSnapshot(loaded.value),
      failureCode: failure.code,
      failureMessage: String(failure.message).split("\n")[0] ?? "Failure",
      embedder: embedder.metadata,
      drift,
    });
    try {
      await writeBrainIndexManifest(vaultRoot, safeOutputDir, manifest);
    } catch {
      // best effort
    }
    throw err;
  }
}

main().catch((err) => {
  process.stderr.write(String(err instanceof Error ? err.message : err));
  process.stderr.write("\n");
  process.exitCode = 1;
});
