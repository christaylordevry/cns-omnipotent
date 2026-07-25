import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/hermes-url-ingest-vault");
const skillPath = join(skillDir, "SKILL.md");
const ingestPromptPath = join(skillDir, "references/ingest-prompt-block.md");

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

describe("Story 88-2 ingest-prompt-block connectivity contract", () => {
  it("encodes rich flexible notes, enumerate-then-batch verify, and no-invent rules", () => {
    assert.ok(existsSync(ingestPromptPath));
    const body = readFileSync(ingestPromptPath, "utf8");

    assert.ok(body.includes("> [!abstract]"), "retains required abstract blockquote");
    assert.ok(body.includes("## Source"), "retains required Source section");
    assert.ok(
      /rich Obsidian note|author richly|Obsidian depth/i.test(body),
      "instructs rich Obsidian authoring",
    );
    assert.ok(
      !/exactly with these sections|at most 12 bullets/i.test(body),
      "does not impose rigid five-section / 12-bullet template",
    );
    assert.ok(
      body.includes("![[") && /embed/i.test(body),
      "cues Obsidian embeds",
    );
    assert.ok(
      /\[!tip\]|\[!warning\]|\[!note\]/.test(body) && body.includes("^block-id"),
      "cues multiple callouts and block IDs",
    );
    assert.ok(
      /first.*mention|inline/i.test(body) && body.includes("[["),
      "requires aggressive inline first-mention wikilinks",
    );
    assert.ok(
      /every.*confirmed|all.*candidates the sweep confirms|Link \*\*every\*\* confirmed/i.test(
        body,
      ),
      "requires linking all confirmed targets, not one",
    );
    assert.ok(
      body.includes("Related Notes") && /supplement/i.test(body),
      "Related Notes is supplement-only",
    );
    assert.ok(
      /Enumerate first|candidate note titles|specific candidate/i.test(body),
      "requires enumerating specific candidate names before search",
    );
    assert.ok(
      /vague topic phrase/i.test(body),
      "forbids vague topic-phrase search as substitute for named candidates",
    );
    assert.ok(
      /vault_search|vault_list/i.test(body) && /batched|as few Vault IO calls/i.test(body),
      "requires batched link-target verification",
    );
    assert.ok(
      /before.*vault_create_note|vault_create_note/i.test(body),
      "verification runs before vault_create_note",
    );
    assert.ok(
      /omit/i.test(body) && /never emit fabricated|Do \*\*not\*\* invent|do \*\*not\*\* invent/i.test(body),
      "omit missing targets; never invent",
    );
    assert.ok(
      !/\(or will have\)/i.test(body),
      "links only concepts that have a note (no 'will have')",
    );
    assert.ok(
      /untrusted/i.test(body) && /em dashes|U\+2014/i.test(body) && /paywalled/i.test(body),
      "retains untrusted, no-em-dash, and paywall rules",
    );
    assert.ok(
      /enrichment|confidence_score/i.test(body),
      "notes Vault IO enrichment mapping (body must not invent YAML)",
    );
  });
});
