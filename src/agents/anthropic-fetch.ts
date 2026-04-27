import { CnsError } from "../errors.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const MIN_RETRY_SLEEP_SECONDS = 5;
const MAX_RETRY_SLEEP_SECONDS = 120;
const DEFAULT_RETRY_AFTER_SECONDS = 5;

export type FetchWithRetryOptions = {
  adapterLabel: string;
  exhaustedMessage?: string;
  maxAttempts?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clampSleepSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return MIN_RETRY_SLEEP_SECONDS;
  }
  if (seconds < MIN_RETRY_SLEEP_SECONDS) return MIN_RETRY_SLEEP_SECONDS;
  if (seconds > MAX_RETRY_SLEEP_SECONDS) return MAX_RETRY_SLEEP_SECONDS;
  return seconds;
}

async function readRetryAfterFromBody(response: Response): Promise<number | undefined> {
  try {
    const clone = response.clone();
    const payload = (await clone.json()) as unknown;
    if (payload && typeof payload === "object" && "error" in payload) {
      const err = (payload as { error?: unknown }).error;
      if (err && typeof err === "object") {
        const ra = (err as { retry_after?: unknown }).retry_after;
        if (typeof ra === "number" && Number.isFinite(ra)) return ra;
        if (typeof ra === "string") {
          const parsed = Number(ra);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  } catch {
    // ignore body parse errors; fall through to header
  }
  return undefined;
}

function readRetryAfterFromHeader(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit,
  options: FetchWithRetryOptions,
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const label = options.adapterLabel;
  const exhaustedMessage =
    options.exhaustedMessage ??
    `Anthropic API rate limited after ${maxAttempts} attempts — ${label}`;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new CnsError(
      "IO_ERROR",
      "fetchWithRetry: maxAttempts must be a positive integer",
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429) {
      return response;
    }

    if (attempt >= maxAttempts) {
      break;
    }

    const bodyRetry = await readRetryAfterFromBody(response);
    const headerRetry =
      bodyRetry === undefined ? readRetryAfterFromHeader(response) : undefined;
    const retrySeconds =
      bodyRetry ?? headerRetry ?? DEFAULT_RETRY_AFTER_SECONDS;
    const clamped = clampSleepSeconds(retrySeconds);
    await sleep(clamped * 1000);
  }

  throw new CnsError(
    "IO_ERROR",
    exhaustedMessage,
    { http_status: 429 },
  );
}
