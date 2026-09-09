const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free-tier providers (Groq, Gemini) put their suggested wait in the error
// body itself, e.g. "Please try again in 2.3475s" — parsed out so we wait
// exactly as long as asked instead of guessing with blind exponential backoff.
function parseRetryAfterMs(body) {
  const match = /try again in ([\d.]+)s/i.exec(body || '');
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

/**
 * fetch() that transparently retries a 429 (rate limited) response using the
 * provider's own Retry-After hint when present, falling back to exponential
 * backoff otherwise. Every other status — including other 4xx/5xx — is
 * returned as-is on the first try for the caller to handle; only 429 is
 * assumed safe to retry blindly since it means "you didn't do anything
 * wrong, just wait."
 */
export async function fetchWithRetry(url, options, { maxRetries = DEFAULT_MAX_RETRIES } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status !== 429 || attempt >= maxRetries) return response;

    const retryAfterHeader = Number(response.headers.get('retry-after'));
    const body = await response.clone().text().catch(() => '');
    const delayMs =
      (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : null) ??
      parseRetryAfterMs(body) ??
      DEFAULT_BASE_DELAY_MS * 2 ** attempt;

    await sleep(delayMs);
  }
}
