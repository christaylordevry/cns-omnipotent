import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendRecord,
  formatAuditLine,
  sanitizeAuditFreeText,
  summarizePayloadForAudit,
} from "../../src/audit/audit-logger.js";

describe("sanitizeAuditFreeText", () => {
  it("replaces pipe, CR, and LF with ASCII space (AC3)", () => {
    expect(sanitizeAuditFreeText("a|b\rc\nd")).toBe("a b c d");
    expect(sanitizeAuditFreeText("x||y")).toBe("x  y");
  });
});

describe("summarizePayloadForAudit", () => {
  it("truncates strings to 120 characters (AC2)", () => {
    const long = "x".repeat(200);
    expect(summarizePayloadForAudit(long)).toHaveLength(120);
    expect(summarizePayloadForAudit("short")).toBe("short");
  });

  it("uses stable sorted JSON then truncates for objects (AC2)", () => {
    const summary = summarizePayloadForAudit({ z: 1, a: { m: 2, b: 1 } });
    expect(summary).toBe('{"a":{"b":1,"m":2},"z":1}'.slice(0, 120));
    expect(summary).not.toContain("|");
  });

  it("sorts keys at all depths", () => {
    expect(summarizePayloadForAudit({ b: { y: 1, x: 2 }, a: 0 })).toBe(
      '{"a":0,"b":{"x":2,"y":1}}'.slice(0, 120),
    );
  });

  it("returns [unserializable] for circular references instead of throwing", () => {
    const a: Record<string, unknown> = {};
    a["self"] = a;
    expect(summarizePayloadForAudit(a)).toBe("[unserializable]");
  });

  it("returns [unserializable] for undefined input", () => {
    expect(summarizePayloadForAudit(undefined)).toBe("[unserializable]");
  });
});

describe("formatAuditLine", () => {
  it("produces six pipe-separated fields and sanitizes free-text segments (AC1, AC3)", () => {
    const line = formatAuditLine("2026-04-02T12:00:00.000Z", {
      action: "move",
      tool: "vault_move",
      surface: "a|b",
      targetPath: "p\nath",
      payloadSummary: "x\r|y",
    });
    expect(line).toBe(
      "[2026-04-02T12:00:00.000Z] | move | vault_move | a b | p ath | x  y",
    );
    expect(line.split("|")).toHaveLength(6);
  });

  it("sanitizes action and tool fields (AC3)", () => {
    const line = formatAuditLine("2026-04-02T12:00:00.000Z", {
      action: "mo|ve",
      tool: "vault\n_move",
      surface: "s",
      targetPath: "t",
      payloadSummary: "p",
    });
    expect(line.split("|")).toHaveLength(6);
    expect(line).not.toMatch(/\r|\n/);
  });

  it("is a single physical line (no raw newlines in output)", () => {
    const line = formatAuditLine("2026-04-02T12:00:00.000Z", {
      action: "x",
      tool: "y",
      surface: "s",
      targetPath: "t",
      payloadSummary: "multi\nline",
    });
    expect(line).not.toMatch(/\r|\n/);
  });
});

describe("appendRecord", () => {
  it("appends one LF-terminated line to agent-log.md under a temp vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-audit-"));
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });

    await appendRecord(vaultRoot, {
      action: "move",
      tool: "vault_move",
      surface: "vitest",
      targetPath: "01-Projects/x.md",
      payloadInput: { source: "a.md", destination: "b.md" },
    });

    const log = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    const lines = log.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+\] \| move \| vault_move \| vitest \| 01-Projects\/x\.md \| /);
    expect(lines[0]).toContain('"destination":"b.md"');
    expect(lines[0]).toContain('"source":"a.md"');
  });
});
