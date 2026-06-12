#!/usr/bin/env node
import { sanitizeNlmAuthText } from "./nlm-auth-watchdog.mjs";

/** @typedef {'size_limit' | 'auth_error' | 'duplicate_source' | 'api_error' | 'nlm_source_rejected' | 'nlm_cli_exception' | 'unknown'} SourceAddErrorClass */

const CLASS_RULES = [
  {
    error_class: /** @type {SourceAddErrorClass} */ ("size_limit"),
    patterns: [
      /\btoo large\b/i,
      /\bsize limit\b/i,
      /\bfile too big\b/i,
      /\bexceeds\b/i,
      /\bpayload too large\b/i,
      /\b413\b/,
      /\brequest entity too large\b/i,
    ],
  },
  {
    error_class: /** @type {SourceAddErrorClass} */ ("auth_error"),
    patterns: [
      /\bunauthenticated\b/i,
      /\bnot authenticated\b/i,
      /\blogin required\b/i,
      /\bsession expired\b/i,
      /\b401\b/,
      /\b403\b/,
      /\bforbidden\b/i,
      /\bunauthorized\b/i,
    ],
  },
  {
    error_class: /** @type {SourceAddErrorClass} */ ("duplicate_source"),
    patterns: [/\bduplicate\b/i, /\balready exists\b/i, /\balready added\b/i],
  },
  {
    error_class: /** @type {SourceAddErrorClass} */ ("api_error"),
    patterns: [
      /\bHTTP 5\d{2}\b/i,
      /\b502\b/,
      /\b503\b/,
      /\b504\b/,
      /\binternal server\b/i,
      /\bservice unavailable\b/i,
    ],
  },
  {
    error_class: /** @type {SourceAddErrorClass} */ ("nlm_source_rejected"),
    patterns: [
      /\bcould not add file source\b/i,
      /\bcould not add source\b/i,
    ],
  },
];

/**
 * @param {string} text
 * @returns {number | null}
 */
export function parseHttpStatus(text) {
  if (!text) {
    return null;
  }
  const patterns = [
    /\bHTTP\s+(\d{3})\b/i,
    /\bstatus\s+code:\s*(\d{3})\b/i,
    /\bstatus:\s*(\d{3})\b/i,
    /\berror\s+(\d{3})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const code = Number.parseInt(match[1], 10);
      if (code >= 100 && code <= 599) {
        return code;
      }
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {SourceAddErrorClass}
 */
export function classifySourceAddError(text) {
  const haystack = text ?? "";
  if (/Traceback \(most recent call last\)/.test(haystack)) {
    return "nlm_cli_exception";
  }
  if (/^╭/m.test(haystack)) {
    return "nlm_cli_exception";
  }
  for (const rule of CLASS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.error_class;
    }
  }
  return "unknown";
}

/**
 * Sanitize fan-out stderr/message for close-report (no secrets, ≤ 160 chars).
 * @param {string} text
 */
export function sanitizeFanoutErrorText(text) {
  return sanitizeNlmAuthText(text ?? "");
}
