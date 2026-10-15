// Helpers for addressing a published Pages site from the console.

/**
 * Public origin of a site. Platform subdomains (`*.pages.<tech-domain>`) are served over
 * https; `*.localhost` hosts (local development) are plain http on the edge's dev port.
 */
export function siteOrigin(host: string): string {
  if (!host) return '';
  if (host.endsWith('.localhost')) {
    const port = (import.meta.env.VITE_PAGES_EDGE_PORT as string | undefined) || '18090';
    return `http://${host}:${port}`;
  }
  return `https://${host}`;
}

/** Turns a site-relative media URL (/media/<hash>.png) into an address the console can load. */
export function siteAssetUrl(host: string, url: string): string {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${siteOrigin(host)}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Strips the preview origin again so stored block content keeps site-relative URLs. */
export function toSiteRelative(host: string, url: string): string {
  const origin = siteOrigin(host);
  return origin && url.startsWith(origin) ? url.slice(origin.length) || '/' : url;
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

/** URL-safe slug from free text (Cyrillic transliterated), as the backend expects. */
export function slugifyText(value: string, max = 60): string {
  let out = '';
  for (const ch of String(value || '').toLowerCase()) out += CYR[ch] ?? ch;
  return out.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max);
}
