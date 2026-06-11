/**
 * Australia/Sydney civil date helpers for morning-digest orchestration.
 * All digest run.date values and artifact filenames must use formatSydneyDate().
 */

/**
 * @param {string | undefined} envTz
 * @param {Date} [now]
 * @returns {string}
 */
export function formatSydneyDate(envTz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: envTz?.trim() || 'Australia/Sydney',
  }).format(now);
}
