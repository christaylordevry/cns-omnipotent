import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertWriteAllowed,
  AUDIT_AGENT_LOG_VAULT_REL,
  INGEST_INDEX_VAULT_REL,
} from "../../src/write-gate.js";

function resolved(vaultRoot: string, ...segments: string[]): string {
  return path.normalize(path.resolve(vaultRoot, ...segments));
}

describe("write gate", () => {
  it("allows a normal inbox note path (tool-write)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const target = resolved(vaultRoot, "00-Inbox", "capture.md");
    expect(() =>
      assertWriteAllowed(vaultRoot, target, { purpose: "tool-write", operation: "create" }),
    ).not.toThrow();
  });

  it("denies writes under AI-Context with PROTECTED_PATH", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const target = resolved(vaultRoot, "AI-Context", "foo.md");
    expect(() => assertWriteAllowed(vaultRoot, target)).toThrowError(expect.objectContaining({ code: "PROTECTED_PATH" }));
    try {
      assertWriteAllowed(vaultRoot, target);
    } catch (e: unknown) {
      expect(e).toMatchObject({
        code: "PROTECTED_PATH",
        details: { path: "AI-Context/foo.md" },
      });
    }
  });

  it("denies writes under _meta/schemas", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const target = resolved(vaultRoot, "_meta", "schemas", "x.yaml");
    expect(() => assertWriteAllowed(vaultRoot, target)).toThrowError(
      expect.objectContaining({ code: "PROTECTED_PATH" }),
    );
  });

  it("denies arbitrary file under _meta (outside logs exception)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const target = resolved(vaultRoot, "_meta", "foo.md");
    expect(() => assertWriteAllowed(vaultRoot, target)).toThrowError(
      expect.objectContaining({ code: "PROTECTED_PATH" }),
    );
  });

  it("allows create/append on ingest index path under _meta", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const target = resolved(vaultRoot, ...INGEST_INDEX_VAULT_REL.split("/"));
    expect(() =>
      assertWriteAllowed(vaultRoot, target, { purpose: "tool-write", operation: "create" }),
    ).not.toThrow();
    expect(() =>
      assertWriteAllowed(vaultRoot, target, { purpose: "tool-write", operation: "append" }),
    ).not.toThrow();
  });

  it("denies writes under _meta/logs except audit-append to agent-log.md", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const other = resolved(vaultRoot, "_meta", "logs", "other.md");
    expect(() => assertWriteAllowed(vaultRoot, other)).toThrowError(
      expect.objectContaining({ code: "PROTECTED_PATH" }),
    );

    const agentLog = resolved(vaultRoot, ...AUDIT_AGENT_LOG_VAULT_REL.split("/"));
    await mkdir(resolved(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(agentLog, "\n", "utf8");

    expect(() => assertWriteAllowed(vaultRoot, agentLog)).toThrowError(
      expect.objectContaining({ code: "PROTECTED_PATH" }),
    );

    expect(() =>
      assertWriteAllowed(vaultRoot, agentLog, { purpose: "audit-append", operation: "append" }),
    ).not.toThrow();
  });

  it("allows audit-append create on agent-log.md", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const agentLog = resolved(vaultRoot, ...AUDIT_AGENT_LOG_VAULT_REL.split("/"));
    expect(() =>
      assertWriteAllowed(vaultRoot, agentLog, { purpose: "audit-append", operation: "create" }),
    ).not.toThrow();
  });

  it("rejects audit-append on agent-log.md for overwrite/delete/mkdir/rename", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const agentLog = resolved(vaultRoot, ...AUDIT_AGENT_LOG_VAULT_REL.split("/"));
    await mkdir(resolved(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(agentLog, "\n", "utf8");
    for (const operation of ["overwrite", "delete", "mkdir", "rename"] as const) {
      expect(() =>
        assertWriteAllowed(vaultRoot, agentLog, { purpose: "audit-append", operation }),
      ).toThrowError(expect.objectContaining({ code: "PROTECTED_PATH" }));
    }
  });

  it("throws VAULT_BOUNDARY when path resolves outside vault via .. (prefix bypass)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const outside = path.resolve(vaultRoot, "..", "outside.md");
    expect(() => assertWriteAllowed(vaultRoot, outside)).toThrowError(
      expect.objectContaining({ code: "VAULT_BOUNDARY" }),
    );
  });

  it("follows symlinks inside the vault when the target stays inside (realpath)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const real = resolved(vaultRoot, "00-Inbox", "real.md");
    await writeFile(real, "x", "utf8");
    const link = resolved(vaultRoot, "00-Inbox", "link.md");
    await symlink(path.join("real.md"), link);
    expect(() =>
      assertWriteAllowed(vaultRoot, link, { purpose: "tool-write", operation: "overwrite" }),
    ).not.toThrow();
  });

  it("throws VAULT_BOUNDARY when a vault path is a symlink to outside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-write-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-out-"));
    const outsideFile = path.join(outsideDir, "secret.md");
    await writeFile(outsideFile, "escape", "utf8");
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const link = resolved(vaultRoot, "00-Inbox", "escape.md");
    await symlink(outsideFile, link);
    expect(() => assertWriteAllowed(vaultRoot, link)).toThrowError(
      expect.objectContaining({ code: "VAULT_BOUNDARY" }),
    );
  });
});
