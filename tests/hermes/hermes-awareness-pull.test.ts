import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HERMES_AWARENESS_SNAPSHOT_KEYS,
  buildAwarenessCacheEnvelope,
  buildAwarenessRequest,
  buildAwarenessUrl,
  convexSiteUrlFromCloudUrl,
  parseAwarenessResponse,
  pullAwarenessSnapshot,
  resolveAwarenessCachePath,
  verifyBearerHeader,
  writeAwarenessCache,
} from "../../scripts/hermes-awareness-pull.js";

const CLOUD_URL = "https://happy-animal-123.convex.cloud/";
const SITE_URL = "https://happy-animal-123.convex.site";
const READ_KEY = "hermes-read-key-test";

function minimalAwarenessSnapshot() {
  return {
    sync: null,
    vault: null,
    chain: null,
    mcps: [],
    digest: { brief: null, topSignals: [] },
    entities: {
      tracked: [],
      emerging: [],
      hasBaselineHistory: false,
    },
    investigations: {
      totalItems: 0,
      columnCounts: {
        triage: 0,
        investigating: 0,
        waiting: 0,
        resolved: 0,
      },
    },
    trends: { anomalies: [], scores: [] },
  };
}

describe("hermes-awareness-pull helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("buildAwarenessUrl / convexSiteUrlFromCloudUrl", () => {
    it("derives .convex.site URL from .convex.cloud CONVEX_URL", () => {
      expect(convexSiteUrlFromCloudUrl(CLOUD_URL)).toBe(SITE_URL);
      expect(
        buildAwarenessUrl({ CONVEX_URL: CLOUD_URL }),
      ).toBe(`${SITE_URL}/hermes/awareness`);
    });

    it("strips trailing slash on cloud URL before site derivation", () => {
      expect(buildAwarenessUrl({ CONVEX_URL: CLOUD_URL })).not.toMatch(/\/\/hermes/);
    });

    it("uses HERMES_AWARENESS_URL override when set", () => {
      const override = "https://custom.example/hermes/awareness";
      expect(
        buildAwarenessUrl({
          CONVEX_URL: CLOUD_URL,
          HERMES_AWARENESS_URL: override,
        }),
      ).toBe(override);
    });

    it("throws when CONVEX_URL is not .convex.cloud", () => {
      expect(() => convexSiteUrlFromCloudUrl("https://example.com")).toThrow(
        /\.convex\.cloud/,
      );
    });
  });

  describe("verifyBearerHeader / buildAwarenessRequest", () => {
    it("builds Authorization Bearer header", () => {
      const { init } = buildAwarenessRequest({
        url: `${SITE_URL}/hermes/awareness`,
        readKey: READ_KEY,
      });
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${READ_KEY}`);
      verifyBearerHeader(headers, READ_KEY);
    });

    it("rejects malformed bearer header", () => {
      expect(() =>
        verifyBearerHeader({ Authorization: "Bearer wrong" }, READ_KEY),
      ).toThrow(/Bearer/);
    });
  });

  describe("parseAwarenessResponse", () => {
    it("requires all top-level DTO keys", () => {
      const snapshot = minimalAwarenessSnapshot();
      const parsed = parseAwarenessResponse(snapshot);
      for (const key of HERMES_AWARENESS_SNAPSHOT_KEYS) {
        expect(parsed).toHaveProperty(key);
      }
    });

    it("throws when a top-level key is missing", () => {
      const incomplete = { ...minimalAwarenessSnapshot() };
      delete (incomplete as Partial<ReturnType<typeof minimalAwarenessSnapshot>>).trends;
      expect(() => parseAwarenessResponse(incomplete)).toThrow(/missing key: trends/);
    });
  });

  describe("pullAwarenessSnapshot", () => {
    it("parses JSON and writes envelope fields on success", async () => {
      const snapshot = minimalAwarenessSnapshot();
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snapshot), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const url = `${SITE_URL}/hermes/awareness`;
      const result = await pullAwarenessSnapshot({ url, readKey: READ_KEY });
      expect(result).toEqual(snapshot);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${READ_KEY}`,
      );
    });

    it("throws on HTTP 401 without touching cache file", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("unauthorized", { status: 401 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const tmpDir = await mkdtemp(path.join(os.tmpdir(), "awareness-pull-"));
      const cachePath = path.join(tmpDir, "awareness-snapshot.json");
      const prior = buildAwarenessCacheEnvelope(
        `${SITE_URL}/hermes/awareness`,
        minimalAwarenessSnapshot(),
        1,
      );
      await writeAwarenessCache(cachePath, prior);

      await expect(
        pullAwarenessSnapshot({
          url: `${SITE_URL}/hermes/awareness`,
          readKey: READ_KEY,
        }),
      ).rejects.toThrow(/unauthorized/);

      const raw = await readFile(cachePath, "utf8");
      expect(JSON.parse(raw)).toEqual(prior);
      await rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe("writeAwarenessCache", () => {
    let tmpDir = "";

    afterEach(async () => {
      if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true });
        tmpDir = "";
      }
    });

    it("writes envelope with pulledAt and snapshot", async () => {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "awareness-cache-"));
      const cachePath = path.join(tmpDir, "nested", "awareness-snapshot.json");
      const snapshot = minimalAwarenessSnapshot();
      const envelope = buildAwarenessCacheEnvelope(
        `${SITE_URL}/hermes/awareness`,
        snapshot,
        42,
      );
      await writeAwarenessCache(cachePath, envelope);

      await access(cachePath);
      const raw = await readFile(cachePath, "utf8");
      const parsed = JSON.parse(raw) as typeof envelope;
      expect(parsed.pulledAt).toBe(42);
      expect(parsed.sourceUrl).toBe(`${SITE_URL}/hermes/awareness`);
      expect(parsed.snapshot).toEqual(snapshot);
    });
  });

  describe("resolveAwarenessCachePath", () => {
    it("defaults to ~/.hermes/memories/awareness-snapshot.json", () => {
      expect(resolveAwarenessCachePath({})).toBe(
        path.join(os.homedir(), ".hermes", "memories", "awareness-snapshot.json"),
      );
    });

    it("expands ~ in HERMES_AWARENESS_CACHE_PATH", () => {
      expect(
        resolveAwarenessCachePath({
          HERMES_AWARENESS_CACHE_PATH: "~/.hermes/custom.json",
        }),
      ).toBe(path.join(os.homedir(), ".hermes", "custom.json"));
    });
  });
});
