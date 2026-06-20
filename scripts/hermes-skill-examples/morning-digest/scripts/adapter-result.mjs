/**
 * Adapter collection result helpers — wrapped shape with legacy bare-object support.
 */

/** Collect-task keys → canonical sourceOutcomes / errors_by_source keys. */
const COLLECT_KEY_TO_SOURCE_KEY = {
  trends: 'google_trends',
};

/** Adapter stdout JSON array keys — shared by error-classification and outcome counting (72-2 DRY). */
export const ADAPTER_PAYLOAD_ARRAY_KEYS = Object.freeze([
  'posts',
  'events',
  'launches',
  'headlines',
  'papers',
  'repos',
  'entries',
  'items',
  'stories',
  // Epic 72-1 / Epic 70-71: success payloads use `videos[]`; keep in set so
  // `{ error, videos: [...] }` is not misclassified as a bare error payload.
  'videos',
  'reels',
  'pins',
  'markets',
]);

export const ADAPTER_DATA_KEYS = new Set(ADAPTER_PAYLOAD_ARRAY_KEYS);

/**
 * @param {unknown} parsed
 * @returns {boolean}
 */
export function isAdapterErrorPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  const row = /** @type {Record<string, unknown>} */ (parsed);
  if (row.error == null || String(row.error).trim() === '') {
    return false;
  }
  return !Object.keys(row).some((key) => ADAPTER_DATA_KEYS.has(key));
}

/**
 * @param {unknown} result
 * @returns {Record<string, unknown>}
 */
export function unwrapAdapterResult(result) {
  if (!result || typeof result !== 'object') {
    return {};
  }
  if ('success' in result) {
    const row = /** @type {{ success?: boolean; data?: unknown; error?: unknown }} */ (result);
    if (row.success === false) {
      return { error: String(row.error ?? 'adapter failed') };
    }
    if (row.data && typeof row.data === 'object') {
      return /** @type {Record<string, unknown>} */ (row.data);
    }
    return {};
  }
  return /** @type {Record<string, unknown>} */ (result);
}

/**
 * @param {Record<string, { success?: boolean; error?: unknown } | unknown>} results
 * @returns {string}
 */
export function summarizeAdapterCollection(results) {
  const parts = [];
  for (const [key, result] of Object.entries(results)) {
    if (result && typeof result === 'object' && 'success' in result) {
      const row = /** @type {{ success?: boolean; error?: unknown }} */ (result);
      if (row.success === true) {
        parts.push(`${key}=ok`);
      } else {
        parts.push(`${key}=fail:${String(row.error ?? 'unknown')}`);
      }
    } else {
      parts.push(`${key}=ok`);
    }
  }
  return `collect: ${parts.join(' ')}`;
}

/**
 * @param {Record<string, { success?: boolean; error?: unknown } | unknown>} results
 * @returns {Record<string, string> | undefined}
 */
export function buildErrorsBySource(results) {
  /** @type {Record<string, string>} */
  const errors = {};
  for (const [key, result] of Object.entries(results)) {
    if (result && typeof result === 'object' && 'success' in result) {
      const row = /** @type {{ success?: boolean; error?: unknown }} */ (result);
      if (row.success === false) {
        const sourceKey = COLLECT_KEY_TO_SOURCE_KEY[key] ?? key;
        errors[sourceKey] = String(row.error ?? 'unknown');
      }
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
