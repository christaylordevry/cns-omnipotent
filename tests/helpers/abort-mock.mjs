/**
 * Shared hung-abort test mocks (OPS-6 Fix B → OPS-7).
 *
 * Why keepalive: `AbortSignal.timeout()` unrefs its timer
 * (`setWeakAbortSignalTimeout` in Node `abort_controller.js`). A mock that
 * only registers an `'abort'` listener holds nothing ref'd → the event loop
 * drains → abort never fires → the test promise stays pending and node
 * reports cancelledByParent, cancelling sibling subtests. Production fetch
 * is fine (socket is ref'd). Listener-only mocks also never settle against
 * an already-aborted signal — `signal.aborted` pre-check is mandatory.
 *
 * Use these factories instead of raw `addEventListener('abort', …)` in tests.
 * A suite-wide ESLint ban (OPS-7) enforces that funnel.
 *
 * Lint allowlist: `no-restricted-syntax` is disabled for this file at config
 * level in `eslint.config.js` (not via disable-next-line — those comments are
 * copy-pasteable and would defeat the ban if carried out with the listener).
 * If a new restricted-syntax selector is added for `tests/**`, re-check this
 * file manually — the file-level override will not apply it here.
 */

/**
 * Hung promise that settles only when `signal` aborts.
 *
 * Starts a ref'd `setInterval` keepalive, pre-checks `signal.aborted`, and
 * rejects via a single `done()` that clears the keepalive then rejects with
 * `signal.reason`.
 *
 * @param {AbortSignal} signal
 * @returns {Promise<never>}
 */
export function hungUntilAbort(signal) {
  return new Promise((_resolve, reject) => {
    const keepalive = globalThis.setInterval(() => {}, 1);
    const done = () => {
      globalThis.clearInterval(keepalive);
      reject(signal.reason);
    };
    if (signal.aborted) {
      done();
      return;
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * Fetch-shaped factory for injection as `fetchFn`.
 * Reads `init.signal` and delegates to {@link hungUntilAbort}.
 *
 * @returns {(url: unknown, init?: { signal?: AbortSignal }) => Promise<never>}
 */
export function createHungAbortFetchMock() {
  return async (_url, init) => {
    const signal = init?.signal;
    if (!(signal instanceof globalThis.AbortSignal)) {
      throw new TypeError("createHungAbortFetchMock requires init.signal");
    }
    return hungUntilAbort(signal);
  };
}
