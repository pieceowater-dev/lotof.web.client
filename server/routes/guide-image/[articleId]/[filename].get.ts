import sharp from 'sharp';

// Mirrors server/routes/publication/[publicationId]/[filename].get.ts exactly,
// for Guide articles' inline images -- see that file for the rationale
// (re-encode to WebP + cap width instead of shipping whatever resolution the
// author's screenshot/photo came in at).
//
// Lives at "/guide-image/..." rather than "/guide/..." -- the latter is two
// path segments, same shape as the public article page route
// (pages/guide/[app]/[slug].vue), and Nitro server routes are matched
// before Nuxt pages, so a "/guide/:articleId/:filename" route here would
// shadow every real article page instead of ever reaching it.
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;
const TRANSFORMABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);

export default defineEventHandler(async (event) => {
  const articleId = String(getRouterParam(event, 'articleId') || '').trim();
  const filename = String(getRouterParam(event, 'filename') || '').trim();

  if (!articleId || !filename) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid guide asset path' });
  }

  // Proxy the bytes directly instead of a 307 redirect -- a redirect costs
  // the browser a full extra round trip before it can even start
  // downloading the image.
  const target = `${getRequestProtocol(event)}://${getRequestHost(event)}/api-capital/guide-image/${encodeURIComponent(articleId)}/${encodeURIComponent(filename)}`;

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
