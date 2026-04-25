export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  console.log('[client-overflow-log]', JSON.stringify(body));

  return {
    ok: true,
  };
});
