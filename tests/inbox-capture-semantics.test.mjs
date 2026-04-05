import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const vaultRoot = join(root, "Knowledge-Vault-ACTIVE");
const inboxReadmePath = join(vaultRoot, "00-Inbox", "_README.md");

const vaultIoModulePath = join(
  root,
  "specs/cns-vault-contract/modules/vault-io.md",
);

const agentsMirrorPath = join(root, "specs/cns-vault-contract/AGENTS.md");

function read(p) {
  return readFileSync(p, "utf8");
}

function extractYamlFrontmatter(body) {
  // Assumes markdown files start with YAML frontmatter delimited by `---`.
  const m = body.match(/^---[\s\S]*?---\s*\n/);
  return m ? m[0] : "";
}

describe("Story 2.2 Inbox capture semantics", () => {
  it("00-Inbox manifest allows minimal/absent PAKE frontmatter on initial create", () => {
    assert.ok(existsSync(inboxReadmePath), `missing ${inboxReadmePath}`);
    const body = read(inboxReadmePath);
    const frontmatter = extractYamlFrontmatter(body);

    assert.ok(
      frontmatter.includes("schema_required: false") &&
        frontmatter.includes("allowed_pake_types: any") &&
        body.includes(
          "Initial create under `00-Inbox/` is allowed without PAKE standard frontmatter."
        ),
      "Inbox initial create must be explicitly allowed without PAKE standard frontmatter (bundle: schema_required false + allowed_pake_types any + initial create sentence)."
    );
    assert.ok(
      body.includes("## Frontmatter Requirements"),
      "missing Frontmatter Requirements section",
    );
    assert.ok(
      body.includes(
        "missing YAML frontmatter at initial creation",
      ),
      "Inbox must explicitly mention that initial captures may be missing YAML frontmatter",
    );
  });

  it("Vault IO writing rules validate PAKE frontmatter outside 00-Inbox", () => {
    assert.ok(existsSync(vaultIoModulePath), `missing ${vaultIoModulePath}`);
    const body = read(vaultIoModulePath);
    assert.ok(
      body.includes(
        "Always validate frontmatter",
      ),
      "Vault IO module must explicitly state 'Always validate frontmatter'",
    );
    assert.ok(
      body.includes("outside `00-Inbox/`"),
      "Vault IO module must explicitly scope PAKE validation to outside `00-Inbox/`",
    );
  });

  it("Constitution formatting rules require YAML frontmatter outside 00-Inbox", () => {
    assert.ok(existsSync(agentsMirrorPath), `missing ${agentsMirrorPath}`);
    const body = read(agentsMirrorPath);
    assert.ok(
      body.includes("**YAML frontmatter** required on all notes outside `00-Inbox/`;"),
      "AGENTS mirror must mention YAML frontmatter rules",
    );
  });
});

