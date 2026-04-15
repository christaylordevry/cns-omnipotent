#!/usr/bin/env node
import { parseArgs } from "node:util";
import { CnsError } from "../errors.js";
import { StubEmbedder } from "./embedder.js";
import { queryBrainIndex } from "./retrieval/query-index.js";

function safeSingleLine(s: string): string {
  return String(s).split(/\r?\n/, 1)[0]?.trim() ?? "Error";
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "index-path": { type: "string" },
      query: { type: "string" },
      "top-k": { type: "string" },
      "min-score": { type: "string" },
      "no-quality-weighting": { type: "boolean" },
      "include-scores": { type: "boolean" },
      "no-include-scores": { type: "boolean" },
      "include-embedder-metadata": { type: "boolean" },
      "no-include-embedder-metadata": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(
      [
        "brain:query — read-only Brain retrieval query over brain-index.json (Story 12.6).",
        "",
        "Usage: tsx src/brain/query-index-cli.ts --index-path <abs-path> --query <text> [--top-k 10] [--min-score 0.2]",
        "",
        "Notes:",
        "- Reads only brain-index.json (and sibling brain-index-manifest.json if present).",
        "- Does not read vault note bodies; returns vault-relative paths only.",
        "",
      ].join("\n"),
    );
    return;
  }

  const indexPath = values["index-path"];
  const query = values.query;
  if (!indexPath || indexPath.trim().length === 0) {
    process.stderr.write("Error: --index-path <abs-path> is required.\n");
    process.exitCode = 1;
    return;
  }
  if (!query || query.trim().length === 0) {
    process.stderr.write("Error: --query <text> is required.\n");
    process.exitCode = 1;
    return;
  }

  const topK = values["top-k"] ? Number(values["top-k"]) : undefined;
  if (topK !== undefined && !Number.isFinite(topK)) {
    process.stderr.write("Error: --top-k must be a finite number.\n");
    process.exitCode = 1;
    return;
  }
  const minScore = values["min-score"] ? Number(values["min-score"]) : undefined;
  if (minScore !== undefined && !Number.isFinite(minScore)) {
    process.stderr.write("Error: --min-score must be a finite number.\n");
    process.exitCode = 1;
    return;
  }
  const includeScores =
    values["no-include-scores"] === true ? false : values["include-scores"] === true ? true : undefined;
  const includeEmbedderMetadata =
    values["no-include-embedder-metadata"] === true
      ? false
      : values["include-embedder-metadata"] === true
        ? true
        : undefined;
  const qualityWeighting = values["no-quality-weighting"] === true ? false : undefined;

  const out = await queryBrainIndex({
    indexPath,
    query,
    topK,
    minScore,
    qualityWeighting,
    includeScores,
    includeEmbedderMetadata,
    embedder: new StubEmbedder(),
  });

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch((err) => {
  const msg =
    err instanceof CnsError ? safeSingleLine(err.message) : err instanceof Error ? safeSingleLine(err.message) : "Error";
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
});

