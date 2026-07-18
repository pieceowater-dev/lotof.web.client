// Retries a flaky async call a few times with a short backoff before giving
// up — meant for requests that go through Nitro's reverse proxy (see
// nuxt.config.ts routeRules), which returns a genuine 502 whenever the
// upstream backend is briefly unreachable (a restart, a rolling deploy, a
// transient network hiccup). Most such gaps resolve within a second, so a
// couple of short retries turn a hard failure into an invisible delay.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastError;
}
