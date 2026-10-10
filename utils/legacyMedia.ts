// Rows written before domains were banned from the DB hold absolute `https://<host>/api-…/media/…`
// URLs (the removed lota.kz mirror, lota.tools, localhost). The files are served by whatever origin the
// page is on, so drop the host when a response arrives; new uploads are stored path-only (utils/mediaUrl.ts).
const LEGACY_HOST = /^https?:\/\/[^/\s]+(?=\/api-[a-z]+\/media\/)/i;

export function rewriteLegacyMediaHosts<T>(value: T): T {
  if (typeof value === 'string') {
    return (LEGACY_HOST.test(value) ? value.replace(LEGACY_HOST, '') : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = rewriteLegacyMediaHosts(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) obj[k] = rewriteLegacyMediaHosts(obj[k]);
  }
  return value;
}
