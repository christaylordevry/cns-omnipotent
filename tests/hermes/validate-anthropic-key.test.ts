import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  VALIDATE_MODEL,
  assertKeyFormat,
  loadAnthropicKeyFromEnvFile,
  maskApiKeyForDisplay,
  parseEnvFile,
  resolveAnthropicApiKey,
  validateAnthropicKey,
} from "../../scripts/validate-anthropic-key.js";

const FAKE_KEY =
  "sk-ant-test000000000000000000000000000000000000000000";

describe("validate-anthropic-key helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("parseEnvFile", () => {
    it("parses KEY=value lines and strips quotes", () => {
      const parsed = parseEnvFile(
        `# comment\nANTHROPIC_API_KEY="${FAKE_KEY}"\nOTHER=x\n`,
      );
      expect(parsed.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
      expect(parsed.OTHER).toBe("x");
    });
  });

  describe("maskApiKeyForDisplay", () => {
    it("masks long keys with first 10 chars and asterisk suffix", () => {
      expect(maskApiKeyForDisplay(FAKE_KEY)).toBe(
        "sk-ant-tes…****",
      );
    });

    it("masks short keys without revealing full value", () => {
      expect(maskApiKeyForDisplay("sk-ant")).toBe("sk-…[masked]");
    });
  });

  describe("assertKeyFormat", () => {
    it("throws for malformed keys before any network call", () => {
      expect(() => assertKeyFormat("not-a-key")).toThrow(
        /malformed ANTHROPIC_API_KEY/,
      );
      expect(() => assertKeyFormat("   ")).toThrow(
        /malformed ANTHROPIC_API_KEY/,
      );
    });

    it("accepts sk-ant- prefixed keys", () => {
      expect(() => assertKeyFormat(FAKE_KEY)).not.toThrow();
    });
  });

  describe("loadAnthropicKeyFromEnvFile", () => {
    it("reports missing env file", () => {
      expect(() =>
        loadAnthropicKeyFromEnvFile("/nonexistent/.env.live-chain"),
      ).toThrow(/missing \/nonexistent\/\.env\.live-chain/);
    });

    it("reports missing ANTHROPIC_API_KEY in file", () => {
      const readFile = vi.fn().mockReturnValue("FIRECRAWL_API_KEY=x\n");
      expect(() =>
        loadAnthropicKeyFromEnvFile("/tmp/.env.live-chain", readFile),
      ).toThrow(/ANTHROPIC_API_KEY not set/);
    });

    it("returns key from env file", () => {
      const readFile = vi
        .fn()
        .mockReturnValue(`ANTHROPIC_API_KEY=${FAKE_KEY}\n`);
      expect(
        loadAnthropicKeyFromEnvFile("/tmp/.env.live-chain", readFile),
      ).toBe(FAKE_KEY);
    });
  });

  describe("resolveAnthropicApiKey", () => {
    it("prefers already-exported process env over file", () => {
      const readFile = vi.fn();
      const key = resolveAnthropicApiKey(
        { ANTHROPIC_API_KEY: FAKE_KEY },
        "/tmp/.env.live-chain",
        readFile,
      );
      expect(key).toBe(FAKE_KEY);
      expect(readFile).not.toHaveBeenCalled();
    });
  });

  describe("validateAnthropicKey", () => {
    it("returns ok on HTTP 200 with correct request shape", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("{}", { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await validateAnthropicKey(FAKE_KEY);

      expect(result).toEqual({ ok: true, status: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe(ANTHROPIC_MESSAGES_URL);
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "x-api-key": FAKE_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      });
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({
        model: VALIDATE_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
    });

    it("returns auth failure on HTTP 401 with actionable message", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("unauthorized", { status: 401 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await validateAnthropicKey(FAKE_KEY);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.message).toMatch(/401/);
        expect(result.message).toMatch(/invalid or revoked/);
        expect(result.message).toMatch(/Key validation and rotation/);
      }
    });
  });

  describe("temp env file fixture", () => {
    let tmpDir: string;

    afterEach(async () => {
      if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true });
        tmpDir = "";
      }
    });

    it("loads key from a real temp .env.live-chain file", async () => {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "validate-key-"));
      const envPath = path.join(tmpDir, ".env.live-chain");
      await writeFile(envPath, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`, "utf8");

      const key = loadAnthropicKeyFromEnvFile(envPath);
      expect(key).toBe(FAKE_KEY);
    });
  });
});
