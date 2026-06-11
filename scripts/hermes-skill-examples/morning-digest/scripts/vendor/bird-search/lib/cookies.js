/**
 * Twitter credential resolution — env-only (CNS Story 68-6).
 * Browser cookie extraction removed; never imports @steipete/sweet-cookie.
 */
const TWITTER_COOKIE_NAMES = ['auth_token', 'ct0'];

function normalizeValue(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cookieHeader(authToken, ct0) {
  return `auth_token=${authToken}; ct0=${ct0}`;
}

function buildEmpty() {
  return { authToken: null, ct0: null, cookieHeader: null, source: null };
}

function readEnvCookie(cookies, keys, field) {
  if (cookies[field]) {
    return;
  }
  for (const key of keys) {
    const value = normalizeValue(process.env[key]);
    if (!value) {
      continue;
    }
    cookies[field] = value;
    if (!cookies.source) {
      cookies.source = `env ${key}`;
    }
    break;
  }
}

/**
 * Resolve Twitter credentials from environment variables only.
 * Priority: CLI args > X_AUTH_TOKEN/X_CT0 > AUTH_TOKEN/CT0 > TWITTER_* aliases.
 */
export async function resolveCredentials(options = {}) {
  const warnings = [];
  const cookies = buildEmpty();

  if (options.authToken) {
    cookies.authToken = options.authToken;
    cookies.source = 'CLI argument';
  }
  if (options.ct0) {
    cookies.ct0 = options.ct0;
    if (!cookies.source) {
      cookies.source = 'CLI argument';
    }
  }

  readEnvCookie(cookies, ['X_AUTH_TOKEN', 'AUTH_TOKEN', 'TWITTER_AUTH_TOKEN'], 'authToken');
  readEnvCookie(cookies, ['X_CT0', 'CT0', 'TWITTER_CT0'], 'ct0');

  if (cookies.authToken && cookies.ct0) {
    cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
    return { cookies, warnings };
  }

  if (!cookies.authToken) {
    warnings.push(
      'Missing auth_token — provide via X_AUTH_TOKEN or AUTH_TOKEN env var',
    );
  }
  if (!cookies.ct0) {
    warnings.push('Missing ct0 — provide via X_CT0 or CT0 env var');
  }
  return { cookies, warnings };
}

/** @deprecated env-only build — browser extraction removed */
export async function extractCookiesFromSafari() {
  return { cookies: buildEmpty(), warnings: ['Browser cookie extraction disabled'] };
}

/** @deprecated env-only build — browser extraction removed */
export async function extractCookiesFromChrome() {
  return { cookies: buildEmpty(), warnings: ['Browser cookie extraction disabled'] };
}

/** @deprecated env-only build — browser extraction removed */
export async function extractCookiesFromFirefox() {
  return { cookies: buildEmpty(), warnings: ['Browser cookie extraction disabled'] };
}

export { TWITTER_COOKIE_NAMES };
