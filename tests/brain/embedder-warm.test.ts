import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StubEmbedder } from "../../src/brain/embedder.js";
import {
  EMBEDDER_WARM_INPUT,
  isEmbedderWarmKeepEnabled,
  isPortalEmbedProxyReachable,
  runEmbedderWarmCli,
} from "../../src/brain/embedder-warm-cli.js";
import { parseBrainRecallPolicy } from "../../src/brain/recall-policy.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  tempDirs.splice(0).forEach(() => {
    /* cleaned in each test */
  });
});

async function writePolicyRepo(params: {
  enabled: boolean;
  voiceTimeout?: number;
}): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "embedder-warm-policy-"));
  tempDirs.push(dir);
  const policy = {
    schema_version: 1,
    policy_version: "test-0.2.1",
    inject_blocked_paths: ["AI-Context/AGENTS.md"],
    channels: {
      voice_pane: {
        max_top_k_fetch: 5,
        min_score_threshold: 0.15,
        max_injection_tokens: 800,
        max_chunks: 2,
      },
      standard_text: {
        max_top_k_fetch: 8,
        min_score_threshold: 0.12,
        max_injection_tokens: 1500,
        max_chunks: 4,
      },
      yapped_text: {
        max_top_k_fetch: 12,
        min_score_threshold: 0.1,
        max_injection_tokens: 3000,
        max_chunks: 6,
      },
    },
    yapped_text_min_chars: 400,
    prefetch: {
      timeout_seconds: 5,
      voice_pane_timeout_seconds: params.voiceTimeout ?? 6,
    },
    embedder_warm_keep: {
      enabled: params.enabled,
      ping_interval_minutes: 10,
      warm_on_dashboard_start: true,
    },
    shadow_mode: false,
  };
  await mkdir(path.join(dir, "config"), { recursive: true });
  await writeFile(path.join(dir, "config/brain-recall-policy.json"), JSON.stringify(policy, null, 2));
  return dir;
}

describe("Story 82-6 embedder warm-keep", () => {
  it("policy gate: exits disabled without network when embedder_warm_keep.enabled is false", async () => {
    const repoRoot = await writePolicyRepo({ enabled: false });
    const fetchSpy = vi.fn();
    const result = await runEmbedderWarmCli({
      repoRoot,
      env: { ...process.env, CNS_BRAIN_EMBEDDER: "portal", CNS_BRAIN_EMBED_MODEL: "text-embedding-3-large" },
    });
    expect(result).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stub embedder: warms once when enabled", async () => {
    const repoRoot = await writePolicyRepo({ enabled: true });
    const embedSpy = vi.spyOn(StubEmbedder.prototype, "embed").mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await runEmbedderWarmCli({
      repoRoot,
      env: {
        ...process.env,
        CNS_BRAIN_EMBEDDER: "stub",
        CNS_BRAIN_EMBED_MODEL: "text-embedding-3-large",
      },
    });

    expect(result).toEqual({ status: "warmed", vectorDimension: 3 });
    expect(embedSpy).toHaveBeenCalledWith(EMBEDDER_WARM_INPUT);
  });

  it("portal mock: skips when proxy health check fails", async () => {
    const repoRoot = await writePolicyRepo({ enabled: true });
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchFn as typeof fetch);

    const reachable = await isPortalEmbedProxyReachable({
      baseUrl: "http://127.0.0.1:8645/v1",
      fetchFn,
    });
    expect(reachable).toBe(false);

    const result = await runEmbedderWarmCli({
      repoRoot,
      env: {
        ...process.env,
        CNS_BRAIN_EMBEDDER: "portal",
        CNS_BRAIN_EMBED_MODEL: "text-embedding-3-large",
      },
    });
    expect(result.status).toBe("skipped_proxy_down");
  });

  it("portal mock: POST /embeddings with minimal warm input when proxy is up", async () => {
    const repoRoot = await writePolicyRepo({ enabled: true });
    const fetchFn = vi
      .fn()
      .mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
        const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (href.endsWith("/models")) {
          return { ok: true, status: 200 } as Response;
        }
        if (href.endsWith("/embeddings")) {
          const body = JSON.parse(String(init?.body));
          expect(body.input).toBe(EMBEDDER_WARM_INPUT);
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ embedding: [0.5, 0.6] }] }),
          } as Response;
        }
        throw new Error(`unexpected fetch: ${href}`);
      });

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchFn as typeof fetch);

    const result = await runEmbedderWarmCli({
      repoRoot,
      env: {
        ...process.env,
        CNS_BRAIN_EMBEDDER: "portal",
        CNS_BRAIN_EMBED_MODEL: "text-embedding-3-large",
        CNS_BRAIN_EMBED_BASE_URL: "http://127.0.0.1:8645/v1",
      },
    });

    expect(result).toEqual({ status: "warmed", vectorDimension: 2 });
    expect(fetchFn).toHaveBeenCalled();
  });

  it("shipped policy parses voice_pane_timeout_seconds default 6", async () => {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path.join(process.cwd(), "config/brain-recall-policy.json"), "utf8");
    const parsed = parseBrainRecallPolicy(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.prefetch?.voice_pane_timeout_seconds).toBe(6);
    expect(parsed.value.prefetch?.timeout_seconds).toBe(5);
    expect(isEmbedderWarmKeepEnabled(parsed.value)).toBe(false);
  });
});
