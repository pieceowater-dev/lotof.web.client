// The `/api-*` routeRules proxy to a fixed backend origin (NUXT_PUBLIC_SITE_URL,
// e.g. https://lota.tools). h3's proxy strips the original Host and does NOT add
// an X-Forwarded-Host, so the gateway behind that origin can't tell which public
// host the user is actually on. It then builds the Google OAuth redirect_uri and
// scopes the auth cookie for the wrong domain -> login silently fails on every
// mirror host (lota.kz): the cookie lands on lota.tools, lota.kz sees nothing.
//
// Stamp the real client-facing host onto the request so the proxied call carries
// it through. Skipped for local dev (localhost/127.0.0.1) where the gateway
// already special-cases the host. X-Forwarded-Proto is left untouched -- the ALB
// sets it in prod and it survives the proxy hop.
export default defineEventHandler((event) => {
  const req = event.node.req;
  if (!(req.url || '').startsWith('/api-')) return;

  const headers = req.headers;
  const host = headers['host'];
  if (
    host &&
    !headers['x-forwarded-host'] &&
    !/^(localhost|127\.0\.0\.1)(:|$)/.test(host)
  ) {
    headers['x-forwarded-host'] = host;
  }
});
