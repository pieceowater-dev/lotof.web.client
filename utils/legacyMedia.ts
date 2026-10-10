// The lota.kz mirror domain was removed (2026-09-10), but uploads made while it was live were stored
// with an absolute `https://lota.kz/api-…/media/…` URL. The files themselves are served by the main
// origin, so rewrite those URLs to origin-relative paths when a response arrives.
const LEGACY_HOST = /^https?:\/\/(?:www\.)?lota\.kz(?=\/(?:api-|media\/))/i;

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
