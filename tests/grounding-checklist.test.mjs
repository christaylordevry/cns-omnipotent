import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checklistPath = join(root, "specs/cns-vault-contract/README.md");

describe("Story 1.3 grounding parity checklist", () => {
  it("specs README exists", () => {
    assert.ok(existsSync(checklistPath), `missing ${checklistPath}`);
  });

  it("contains required section anchors and keywords", () => {
    const body = readFileSync(checklistPath, "utf8");
    assert.ok(
      /## Grounding parity checklist/i.test(body),
      "missing ## Grounding parity checklist",
    );
    assert.ok(
      /NFR-I1|Parity \(NFR-I1\)/i.test(body),
      "missing NFR-I1 parity subsection",
    );
    assert.ok(
      /NFR-P1|30 seconds|under 30 second/i.test(body),
      "missing NFR-P1 or 30 second target",
    );
    assert.ok(/Cursor.*WSL|WSL.*Cursor/is.test(body), "missing Cursor on WSL");
    assert.ok(
      /Claude Code.*WSL|WSL.*Claude/is.test(body),
      "missing Claude Code on WSL",
    );
    assert.ok(/\bMCP\b/i.test(body), "missing MCP");
    assert.ok(
      /task-ready|Task-ready/i.test(body),
      "missing task-ready stop condition",
    );
    assert.ok(
      /AI-Context\/AGENTS\.md/.test(body),
      "missing AI-Context/AGENTS.md reference",
    );
    assert.ok(
      /Vault IO|vault-io/i.test(body),
      "missing Vault IO reference",
    );
  });
});
