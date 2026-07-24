import sharp from 'sharp';

// Hero images get uploaded at whatever resolution the author's phone/camera
// produced (PageSpeed measured a ~155 KiB transfer on one real article,
// mostly wasted -- the image never renders wider than the article column).
// Re-encoding to WebP and capping the width fixes that without needing any
// change on the upload/CMS side.
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;
const TRANSFORMABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);

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

  const upstream = await fetch(target, {
    headers: { cookie: getHeader(event, 'cookie') || '' },
  });

  if (!upstream.ok || !upstream.body) {
    setResponseStatus(event, upstream.status || 502);
    return send(event, await upstream.text().catch(() => ''));
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const acceptsWebp = (getHeader(event, 'accept') || '').includes('image/webp');
  const buffer = Buffer.from(await upstream.arrayBuffer());

  // Every upload gets a fresh, random asset ID server-side (never reused or
  // overwritten in place), so this exact URL's bytes never change -- safe
  // to cache for as long as the browser will keep it.
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable');

  if (acceptsWebp && TRANSFORMABLE_TYPES.has(contentType)) {
    try {
      const transformed = await sharp(buffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      setHeader(event, 'content-type', 'image/webp');
      return send(event, transformed);
    } catch {
      // Corrupt/unsupported image data, or a non-image file that happens to
      // share one of the transformable content-types -- fall through and
      // serve the original bytes untouched rather than 500ing the page.
    }
  }

  setHeader(event, 'content-type', contentType);
  return send(event, buffer);
});
