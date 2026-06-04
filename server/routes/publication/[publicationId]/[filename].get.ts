export default defineEventHandler(async (event) => {
  const publicationId = String(getRouterParam(event, 'publicationId') || '').trim();
  const filename = String(getRouterParam(event, 'filename') || '').trim();

  if (!publicationId || !filename) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid publication asset path' });
  }

  const capitalUrl = String(process.env.VITE_API_CAPITAL || 'http://localhost:8082').replace(/\/$/, '');
  const upstreamUrl = `${capitalUrl}/publication/${encodeURIComponent(publicationId)}/${encodeURIComponent(filename)}`;

  const response = await fetch(upstreamUrl);
  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: 'Publication asset not found' });
  }

  const contentType = String(response.headers.get('content-type') || 'application/octet-stream').trim();
  const cacheControl = String(response.headers.get('cache-control') || 'public, max-age=300').trim();

  setHeader(event, 'content-type', contentType);
  setHeader(event, 'cache-control', cacheControl);

  return new Uint8Array(await response.arrayBuffer());
});
