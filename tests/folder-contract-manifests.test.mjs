import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const vaultRoot = join(root, "Knowledge-Vault-ACTIVE");
const manifestDirs = [
  { dir: "00-Inbox", schemaRequired: false, expectedAllowedPake: "allowed_pake_types: any" },
  { dir: "01-Projects", schemaRequired: true, expectedAllowedPake: "allowed_pake_types: WorkflowNote" },
  { dir: "02-Areas", schemaRequired: true, expectedAllowedPake: "allowed_pake_types: WorkflowNote" },
  { dir: "03-Resources", schemaRequired: true, expectedAllowedPake: "allowed_pake_types: SourceNote | InsightNote | SynthesisNote | ValidationNote" },
  { dir: "04-Archives", schemaRequired: true, expectedAllowedPake: "allowed_pake_types: any" },
  { dir: "DailyNotes", schemaRequired: true, expectedAllowedPake: "allowed_pake_types: WorkflowNote" },
];

function readManifest(dirName) {
  const p = join(vaultRoot, dirName, "_README.md");
  assert.ok(existsSync(p), `missing manifest: ${p}`);
  return readFileSync(p, "utf8");
}

function extractFrontmatterYaml(body) {
  // Assumes manifest files start with YAML frontmatter delimited by `---`.
  const m = body.match(/^---[\s\S]*?---\s*\n/);
  return m ? m[0] : "";
}

describe("Story 2.1 folder contract directory manifests", () => {
  it("creates a mock Knowledge-Vault-ACTIVE root", () => {
    assert.ok(existsSync(vaultRoot), `missing ${vaultRoot}`);
  });

  for (const { dir, schemaRequired, expectedAllowedPake } of manifestDirs) {
    it(`has correct template and frontmatter keys for ${dir}`, () => {
      const body = readManifest(dir);
      const frontmatterYaml = extractFrontmatterYaml(body);

      // Guardrail: avoid unicode em dash and double-hyphen sequences.
      assert.ok(!body.includes("—"), "should not contain em dash character");
      assert.ok(!body.includes("–"), "should not contain en dash character");
      // Allow YAML frontmatter delimiter `---` at the top of the file.
      const bodyWithoutFrontmatter = body.replace(/^---[\s\S]*?---\s*\n/, "");
      assert.ok(
        !bodyWithoutFrontmatter.includes("--"),
        "should not contain double-hyphen sequence outside YAML frontmatter"
      );

      assert.ok(
        body.includes("purpose:"),
        `missing purpose: frontmatter key in ${dir}`
      );
      assert.ok(
        body.includes("schema_required:"),
        `missing schema_required in ${dir}`
      );
      assert.ok(
        body.includes("allowed_pake_types:"),
        `missing allowed_pake_types in ${dir}`
      );
      assert.ok(
        body.includes("naming_convention:"),
        `missing naming_convention in ${dir}`
      );

      const schemaNeedle = `schema_required: ${schemaRequired}`;
      assert.ok(
        body.includes(schemaNeedle),
        `expected ${schemaNeedle} in ${dir}`
      );

      assert.ok(
        body.includes("## What Goes Here"),
        `missing ## What Goes Here in ${dir}`
      );
      assert.ok(
        body.includes("## What Does Not Go Here"),
        `missing ## What Does Not Go Here in ${dir}`
      );
      assert.ok(
        body.includes("## Frontmatter Requirements"),
        `missing ## Frontmatter Requirements in ${dir}`
      );

      assert.ok(
        frontmatterYaml.includes(expectedAllowedPake),
        `expected ${expectedAllowedPake} in YAML frontmatter for ${dir}`
      );
    });
  }

  it("DailyNotes manifest references ISO date naming", () => {
    const body = readManifest("DailyNotes");
    assert.ok(
      body.includes("YYYY-MM-DD.md"),
      "DailyNotes manifest must mention YYYY-MM-DD.md"
    );
  });
});

