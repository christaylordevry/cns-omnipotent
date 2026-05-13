import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before } from "node:test";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = join(root, "Knowledge-Vault-ACTIVE");
const indexPath = join(vaultRoot, "AI-Context", "vault-fast-scan-index.md");

describe("Story 29-9 vault fast-scan index", () => {
  before(() => {
    const r = spawnSync(
      process.execPath,
      [join(root, "scripts", "generate-vault-fast-scan-index.mjs")],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CNS_VAULT_ROOT: vaultRoot },
      },
    );
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
  });

  it("writes index with normative header and token budget", () => {
    assert.ok(existsSync(indexPath), `missing ${indexPath}`);
    const text = readFileSync(indexPath, "utf8");
    const lines = text.split("\n");
    assert.strictEqual(
      lines[0],
      "# Vault Fast-Scan Index (auto — /session-close)",
    );
    assert.ok(lines[1].startsWith("# Format:"));
    assert.ok(lines[2].includes("Token budget"));
    assert.ok(lines[2].includes("Cap: 100"));
    assert.strictEqual(lines[3], "");
    const est = Math.ceil(text.length / 4);
    assert.ok(est <= 2000, `estimated tokens ${est} exceed 2000`);
  });

  it("each data line matches TYPE path | title | date", () => {
    const text = readFileSync(indexPath, "utf8");
    const dataLines = text
      .split("\n")
      .slice(4)
      .filter((l) => l.trim().length > 0);
    const re =
      /^(SRC|INS|SYN|DLY|OTH) (01-Projects|02-Areas|03-Resources)\/[^\n|]+\.md \| [^\n|]+ \| \d{4}-\d{2}-\d{2}$/;
    for (const line of dataLines) {
      assert.ok(
        re.test(line),
        `bad line: ${line.slice(0, 120)}`,
      );
    }
    assert.ok(dataLines.length <= 100, `too many lines: ${dataLines.length}`);
  });
});
