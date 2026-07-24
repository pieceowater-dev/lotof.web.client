export default defineEventHandler(async (event) => {
  const publicationId = String(getRouterParam(event, 'publicationId') || '').trim();
  const filename = String(getRouterParam(event, 'filename') || '').trim();

  if (!publicationId || !filename) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid publication asset path' });
  }

  // Proxy the bytes directly instead of a 307 redirect -- a redirect costs
  // the browser a full extra round trip before it can even start
  // downloading the image, which is exactly what delays LCP on article
  // pages where this is the hero image.
  const target = `${getRequestProtocol(event)}://${getRequestHost(event)}/api-capital/publication/${encodeURIComponent(publicationId)}/${encodeURIComponent(filename)}`;
  return proxyRequest(event, target, {
    onResponse(responseEvent, response) {
      if (!response.ok) return;
      // Every upload gets a fresh, random asset ID server-side (never
      // reused or overwritten in place), so this exact URL's bytes never
      // change -- safe to cache for as long as the browser will keep it.
      // Set after the upstream fetch so it isn't clobbered by whatever
      // cache-control (if any) the upstream responds with.
      setHeader(responseEvent, 'cache-control', 'public, max-age=31536000, immutable');
    },
  });
});
