import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/hermes-url-ingest-vault");
const skillPath = join(skillDir, "SKILL.md");

describe("Story 36-2 Hermes url-ingest-vault skill mirror", () => {
  it("defines the skill package with #general references and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(
      existsSync(join(skillDir, "references/general-capture-prompt.md")),
    );
    assert.ok(
      existsSync(join(skillDir, "references/general-config-snippet.md")),
    );
    assert.ok(
      existsSync(join(root, "scripts/install-hermes-skill-url-ingest-vault.sh")),
    );

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: hermes-url-ingest-vault"));
    assert.ok(body.includes("#general channel: capture-only mode"));
  });
});
