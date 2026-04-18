import path from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { assertWriteAllowed, INGEST_INDEX_VAULT_REL } from "../write-gate.js";

export { INGEST_INDEX_VAULT_REL };

const INDEX_HEADER = `| date | pake_id | pake_type | title | source_uri | vault_path |
|------|---------|-----------|-------|------------|------------|
`;

export type IndexRow = {
  date: string;
  pake_id: string;
  pake_type: string;
  title: string;
  source_uri: string;
  vault_path: string;
};

/** Sanitize a table cell value: replace pipes and newlines with spaces. */
function sanitizeCell(value: string): string {
  return value.replace(/\|/g, " ").replace(/[\r\n]/g, " ").trim();
}

/** Format one index row as a Markdown table line (no trailing newline). */
export function formatIndexRow(row: IndexRow): string {
  return (
    `| ${sanitizeCell(row.date)}` +
    ` | ${sanitizeCell(row.pake_id)}` +
    ` | ${sanitizeCell(row.pake_type)}` +
    ` | ${sanitizeCell(row.title)}` +
    ` | ${sanitizeCell(row.source_uri)}` +
    ` | ${sanitizeCell(row.vault_path)} |`
  );
}

/**
 * Append one row to the master ingest index.
 * Creates the file with a header if it does not already exist.
 */
export async function appendIndexRow(vaultRoot: string, row: IndexRow): Promise<void> {
  const indexAbs = path.join(path.resolve(vaultRoot), ...INGEST_INDEX_VAULT_REL.split("/"));
  const dir = path.dirname(indexAbs);
  await mkdir(dir, { recursive: true });

  let exists = false;
  try {
    await readFile(indexAbs, "utf8");
    exists = true;
  } catch {
    /* file does not exist yet */
  }

  assertWriteAllowed(vaultRoot, indexAbs, {
    operation: exists ? "append" : "create",
  });

  if (!exists) {
    await writeFile(indexAbs, INDEX_HEADER, "utf8");
  }

  const line = formatIndexRow(row) + "\n";
  await appendFile(indexAbs, line, "utf8");
}
