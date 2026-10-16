// Local development only: the gateways allow the exact origin http://localhost:<port> (CORS), so a console opened from
// http://127.0.0.1:3000 or http://0.0.0.0:3000 fails every API call with "Load failed" / "access control checks",
// and each failed call is retried with backoff, which makes the whole app look frozen. Move to the localhost origin.
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return;
  const { hostname, port, pathname, search, hash, protocol } = window.location;
  if (hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]') {
    window.location.replace(`${protocol}//localhost${port ? `:${port}` : ''}${pathname}${search}${hash}`);
  }
});
