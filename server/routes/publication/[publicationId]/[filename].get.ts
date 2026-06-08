export default defineEventHandler(async (event) => {
  const publicationId = String(getRouterParam(event, 'publicationId') || '').trim();
  const filename = String(getRouterParam(event, 'filename') || '').trim();

  if (!publicationId || !filename) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid publication asset path' });
  }

  const target = `/api-capital/publication/${encodeURIComponent(publicationId)}/${encodeURIComponent(filename)}`;
  return sendRedirect(event, target, 307);
});
