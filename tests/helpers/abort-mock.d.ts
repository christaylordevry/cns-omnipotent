/**
 * Type surface for `abort-mock.mjs` — implementation SSOT stays in the `.mjs`.
 * Co-located so `portal-embedder.test.ts` can import type-clean under strict
 * typescript-eslint without `allowJs` or `any` casts (OPS-7).
 */

/** Hung promise that settles only when `signal` aborts. */
export function hungUntilAbort(signal: AbortSignal): Promise<never>;

/**
 * Fetch-shaped factory for injection as `fetchFn`.
 * Reads `init.signal` and delegates to {@link hungUntilAbort}.
 */
export function createHungAbortFetchMock(): (
  url: unknown,
  init?: { signal?: AbortSignal },
) => Promise<never>;
