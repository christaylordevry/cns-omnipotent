import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/hermes-url-auto-capture-inbox");
const skillPath = join(skillDir, "SKILL.md");
const capturePromptPath = join(skillDir, "references/capture-prompt.md");
const configSnippetPath = join(skillDir, "references/config-snippet.md");
const operatorGuidePath = join(root, "Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md");

describe("Story 28.3 Hermes #general URL auto-capture skill mirror", () => {
  it("defines the capture-only skill package and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(capturePromptPath));
    assert.ok(existsSync(configSnippetPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-url-auto-capture-inbox.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: hermes-url-auto-capture-inbox"));
    assert.ok(body.includes("#general"));
    assert.ok(body.includes("1484880486785486951"));
    assert.ok(body.includes("00-Inbox/"));
    assert.ok(body.includes("capture only"));
    assert.ok(body.includes("must not call `vault_create_note`"));
    assert.ok(body.includes("must not call `vault_move`"));
  });

  it("documents URL trigger, SSRF refusal, timeout, and 3 URL cap", () => {
    const body = readFileSync(capturePromptPath, "utf8");
    assert.ok(body.includes("http://") && body.includes("https://"));
    assert.ok(body.includes("ftp://"));
    assert.ok(body.includes("bare domains"));
    assert.ok(body.includes("first-seen wins"));
    assert.ok(body.includes("at most **3** distinct URLs"));
    assert.ok(body.includes("additional_urls_omitted"));
    assert.ok(body.includes("localhost"));
    assert.ok(body.includes("RFC1918"));
    assert.ok(body.includes("IPv6 link-local"));
    assert.ok(body.includes("unique local"));
    assert.ok(body.includes("30s"));
    assert.ok(body.includes("failure_class"));
  });

  it("defines deterministic Inbox filename and unstructured capture body", () => {
    const body = readFileSync(capturePromptPath, "utf8");
    assert.ok(body.includes("00-Inbox/hermes-auto-capture-"));
    assert.ok(body.includes("/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/00-Inbox/"));
    assert.ok(body.includes("UTC timestamp"));
    assert.ok(body.includes("hostname slug"));
    assert.ok(body.includes("collision suffix"));
    assert.ok(body.includes("Do not overwrite"));
    assert.ok(body.includes("No YAML frontmatter is required"));
    assert.ok(body.includes("Capture timestamp"));
    assert.ok(body.includes("Original URL"));
  });

  it("config snippet binds only #general and preserves #hermes skills", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("1484880486785486951"));
    assert.ok(body.includes("1500733488897462382"));
    assert.ok(body.includes("channel_skill_bindings"));
    assert.ok(body.includes("hermes-url-auto-capture-inbox"));
    assert.ok(body.includes("hermes-url-ingest-vault"));
    assert.ok(body.includes("triage"));
    assert.ok(body.includes("session-close"));
  });

  it("operator guide documents #general auto-capture and version history", () => {
    const body = readFileSync(operatorGuidePath, "utf8");
    assert.ok(body.includes("28-3-wire-general-auto-ingest"));
    assert.ok(body.includes("### 15.5 General URL auto-capture (`#general`, Epic 28)"));
    assert.ok(body.includes("1484880486785486951"));
    assert.ok(body.includes("00-Inbox/"));
    assert.ok(body.includes("/triage"));
    assert.ok(body.includes("SSRF"));
    assert.ok(body.includes("3"));
  });
});
