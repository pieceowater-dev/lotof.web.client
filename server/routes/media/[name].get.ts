// Nitro's static handler ignores Range headers, and iOS Safari refuses to
// play an mp4 that can't be fetched in byte ranges -- so the promo video is
// served from here (server asset in memory, ~1 MB) with proper 206 support.
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') || '';
  if (!/^[\w-]+\.mp4$/.test(name)) throw createError({ statusCode: 404 });

  const raw = await useStorage('assets:media').getItemRaw(name);
  if (!raw) throw createError({ statusCode: 404 });
  const u8 = raw as Uint8Array;
  const buf = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength); // view, not a copy: the film is ~10 MB
  const size = buf.length;

  setHeader(event, 'Content-Type', 'video/mp4');
  setHeader(event, 'Accept-Ranges', 'bytes');
  setHeader(event, 'Cache-Control', 'public, max-age=86400');

  const m = /^bytes=(\d*)-(\d*)$/.exec(getHeader(event, 'range') || '');
  if (!m || (!m[1] && !m[2])) {
    setHeader(event, 'Content-Length', size);
    return buf;
  }
  let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
  let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end) {
    setResponseStatus(event, 416);
    setHeader(event, 'Content-Range', `bytes */${size}`);
    return '';
  }
  setResponseStatus(event, 206);
  setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`);
  setHeader(event, 'Content-Length', end - start + 1);
  return buf.subarray(start, end + 1);
});
