import type { Embedder } from "./embedder.js";
import {
  channelsForGoldenQuery,
  type BrainGoldenQueries,
  type GoldenQuery,
} from "./golden-queries.js";
import type { TokenCounter } from "./inference-token-counter.js";
import {
  buildRecallInjection,
  estimateInjectionTokens,
} from "./recall-inject.js";
import {
  channelPolicyFor,
  type BrainRecallPolicy,
  type RecallChannel,
} from "./recall-policy.js";
import { queryBrainIndex } from "./retrieval/query-index.js";

export type TokenMeasure = "actual" | "estimate";

export type CalibrationChannelResult = {
  channel: RecallChannel;
  k: number;
  precisionAtK: number;
  retrievedPaths: string[];
  citedPaths: string[];
  /** Forbidden paths present in retrieval top-k (warning only — citations gate pass/fail). */
  forbiddenInRetrieval: string[];
  tokensUsedEstimate: number;
  tokensUsedActual: number | null;
  /** Whether budget gate used inference API count or chars/4 estimate. */
  tokenMeasure: TokenMeasure;
  injectionBudget: number;
  withinBudget: boolean;
  recallPass: boolean;
  forbiddenPass: boolean;
  passed: boolean;
  shadow: boolean;
  wouldInjectContext: string | null;
};

export type CalibrationQueryResult = {
  queryId: string;
  prompt: string;
  channels: CalibrationChannelResult[];
  passed: boolean;
  warnings: string[];
  /** Per-channel token source, e.g. `standard_text=actual, voice_pane=estimate`. */
  tokenMeasureSummary: string;
};

export type CalibrationReport = {
  policyVersion: string;
  shadowMode: boolean;
  goldenQueryCount: number;
  results: CalibrationQueryResult[];
  passed: boolean;
  summary: {
    totalChannelRuns: number;
    passedChannelRuns: number;
    failedChannelRuns: number;
    warnings: string[];
    tokenCountDegraded: boolean;
  };
};

export type RunCalibrationHarnessParams = {
  vaultRoot: string;
  indexPath: string;
  policy: BrainRecallPolicy;
  goldenQueries: BrainGoldenQueries;
  embedder: Embedder;
  /** When set, reports actual inference tokens for would-inject payload (FR19). */
  countTokens?: TokenCounter | null;
  /** When true, log shadow payloads to stderr. */
  logShadowPayloads?: boolean;
};

/**
 * precision@k = |expected ∩ retrieved[:k]| / |expected|
 */
export function precisionAtK(retrievedPaths: string[], expectedPaths: string[], k: number): number {
  if (expectedPaths.length === 0) {
    return 0;
  }
  const topK = new Set(retrievedPaths.slice(0, Math.max(0, k)));
  const hits = expectedPaths.filter((p) => topK.has(p)).length;
  return hits / expectedPaths.length;
}

function normalizePathList(paths: string[]): string[] {
  return paths.map((p) => p.replace(/\\/g, "/"));
}

function hasForbiddenCitation(citedPaths: string[], forbidden: string[] | undefined): boolean {
  if (!forbidden || forbidden.length === 0) {
    return false;
  }
  const forbiddenSet = new Set(normalizePathList(forbidden));
  return citedPaths.some((p) => forbiddenSet.has(p));
}

/** Forbidden paths in retrieval top-k — informational warning; does not fail the query. */
export function forbiddenPathsInRetrieval(
  retrievedPaths: string[],
  forbidden: string[] | undefined,
  k: number,
): string[] {
  if (!forbidden || forbidden.length === 0) {
    return [];
  }
  const forbiddenSet = new Set(normalizePathList(forbidden));
  return normalizePathList(retrievedPaths.slice(0, Math.max(0, k))).filter((p) => forbiddenSet.has(p));
}

function recallPass(citedPaths: string[], expectedPaths: string[]): boolean {
  const expected = new Set(normalizePathList(expectedPaths));
  return citedPaths.some((p) => expected.has(p));
}

function formatTokenMeasureSummary(channels: CalibrationChannelResult[]): string {
  return channels.map((ch) => `${ch.channel}=${ch.tokenMeasure}`).join(", ");
}

export async function runCalibrationForQuery(params: {
  vaultRoot: string;
  indexPath: string;
  policy: BrainRecallPolicy;
  query: GoldenQuery;
  embedder: Embedder;
  countTokens?: TokenCounter | null;
  logShadowPayloads?: boolean;
  /** When set, receives token-count degradation warnings (for tests). */
  onTokenCountDegraded?: (message: string) => void;
}): Promise<CalibrationQueryResult> {
  const channels = channelsForGoldenQuery(params.query);
  const channelResults: CalibrationChannelResult[] = [];
  const queryWarnings: string[] = [];

  for (const channel of channels) {
    const channelPolicy = channelPolicyFor(params.policy, channel);
    const k = channelPolicy.max_top_k_fetch;

    const queryOut = await queryBrainIndex({
      indexPath: params.indexPath,
      query: params.query.prompt,
      topK: k,
      minScore: channelPolicy.min_score_threshold,
      qualityWeighting: channelPolicy.quality_weighting ?? true,
      qualityWeightStrength: params.policy.index?.quality_weight_strength,
      staleSamplePenaltyFactor: params.policy.index?.stale_penalty_factor,
      includeScores: true,
      includeEmbedderMetadata: false,
      embedder: params.embedder,
    });

    const retrievedPaths = queryOut.results.map((r) => r.path);
    const precision = precisionAtK(retrievedPaths, params.query.expected_paths, k);
    const forbiddenInRetrieval = forbiddenPathsInRetrieval(
      retrievedPaths,
      params.query.forbidden_paths,
      k,
    );

    if (forbiddenInRetrieval.length > 0) {
      const warnMsg = `${params.query.id}/${channel}: forbidden in retrieval (not cited): ${forbiddenInRetrieval.join(", ")}`;
      queryWarnings.push(warnMsg);
      process.stderr.write(`[cns-brain-calibration warn] ${warnMsg}\n`);
    }

    const injectOut = await buildRecallInjection({
      vaultRoot: params.vaultRoot,
      indexPath: params.indexPath,
      query: params.query.prompt,
      channel,
      policy: params.policy,
      embedder: params.embedder,
    });

    const citedPaths = injectOut.citations.map((c) => c.path);
    const wouldInject = injectOut.wouldInjectContext;
    let tokensUsedActual: number | null = null;
    let tokenMeasure: TokenMeasure = "estimate";

    if (wouldInject && wouldInject.length > 0 && params.countTokens) {
      try {
        tokensUsedActual = await params.countTokens(wouldInject);
        tokenMeasure = "actual";
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const degradeMsg = `${params.query.id}/${channel}: token count unavailable (${detail}); using chars/4 estimate`;
        queryWarnings.push(degradeMsg);
        params.onTokenCountDegraded?.(degradeMsg);
        process.stderr.write(`[cns-brain-calibration warn] ${degradeMsg}\n`);
      }
    }

    const tokensUsedEstimate =
      wouldInject && wouldInject.length > 0 ? estimateInjectionTokens(wouldInject) : injectOut.tokensUsedEstimate;

    const withinBudget =
      tokensUsedActual !== null
        ? tokensUsedActual <= channelPolicy.max_injection_tokens
        : injectOut.tokensUsedEstimate <= channelPolicy.max_injection_tokens;

    const recallOk = recallPass(citedPaths, params.query.expected_paths);
    const forbiddenOk = !hasForbiddenCitation(citedPaths, params.query.forbidden_paths);
    const precisionOk = precision >= 1;
    const passed = recallOk && forbiddenOk && precisionOk && withinBudget;

    if (params.logShadowPayloads && injectOut.shadow && wouldInject) {
      process.stderr.write(
        `[cns-brain-calibration shadow] query=${params.query.id} channel=${channel}\n${wouldInject}\n---\n`,
      );
    }

    channelResults.push({
      channel,
      k,
      precisionAtK: precision,
      retrievedPaths,
      citedPaths,
      forbiddenInRetrieval,
      tokensUsedEstimate,
      tokensUsedActual,
      tokenMeasure,
      injectionBudget: channelPolicy.max_injection_tokens,
      withinBudget,
      recallPass: recallOk,
      forbiddenPass: forbiddenOk,
      passed,
      shadow: injectOut.shadow,
      wouldInjectContext: wouldInject,
    });
  }

  return {
    queryId: params.query.id,
    prompt: params.query.prompt,
    channels: channelResults,
    passed: channelResults.every((c) => c.passed),
    warnings: queryWarnings,
    tokenMeasureSummary: formatTokenMeasureSummary(channelResults),
  };
}

export async function runCalibrationHarness(params: RunCalibrationHarnessParams): Promise<CalibrationReport> {
  const results: CalibrationQueryResult[] = [];

  for (const query of params.goldenQueries.queries) {
    results.push(
      await runCalibrationForQuery({
        vaultRoot: params.vaultRoot,
        indexPath: params.indexPath,
        policy: params.policy,
        query,
        embedder: params.embedder,
        countTokens: params.countTokens,
        logShadowPayloads: params.logShadowPayloads,
      }),
    );
  }

  const totalChannelRuns = results.reduce((n, r) => n + r.channels.length, 0);
  const passedChannelRuns = results.reduce((n, r) => n + r.channels.filter((c) => c.passed).length, 0);
  const warnings = results.flatMap((r) => r.warnings);
  const tokenCountDegraded = warnings.some((w) => w.includes("token count unavailable"));

  return {
    policyVersion: params.policy.policy_version,
    shadowMode: params.policy.shadow_mode === true,
    goldenQueryCount: params.goldenQueries.queries.length,
    results,
    passed: results.every((r) => r.passed),
    summary: {
      totalChannelRuns,
      passedChannelRuns,
      failedChannelRuns: totalChannelRuns - passedChannelRuns,
      warnings,
      tokenCountDegraded,
    },
  };
}

/** Derive recall channel for a golden prompt (standard vs yapped heuristic). */
