import { DEFAULT_SITE_URL } from '../../utils/siteUrl';

// Served dynamically (was public/robots.txt) so the Sitemap line reflects the
// host the request actually came in on -- robots.txt fetched from lota.kz
// advertises lota.kz/sitemap.xml, from lota.tools advertises lota.tools, etc.
// Falls back to NUXT_PUBLIC_SITE_URL, then DEFAULT_SITE_URL.
const BODY = `# Allow all crawlers
User-agent: *
Allow: /
Allow: /news
Allow: /feed

# Disallow authenticated/internal areas
# /[namespace]/atrace/*
Disallow: /*/atrace/
# /[namespace]/contacts/*
Disallow: /*/contacts/
# /[namespace]/issues/*
Disallow: /*/issues/
# /[namespace]/menu/*
Disallow: /*/menu/
# /console/*
Disallow: /console/
# /to/[namespace]/* (shared namespace views)
Disallow: /to/

# Disallow technical endpoints/files
Disallow: /api/
Disallow: /*.json$

# Sitemap location
Sitemap: __SITE_URL__/sitemap.xml
`;

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);

  const forwardedHost = String(getHeader(event, 'x-forwarded-host') || '').trim();
  const host = String(getHeader(event, 'host') || '').trim();
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '').trim().toLowerCase();
  const proto = forwardedProto === 'https' ? 'https' : forwardedProto === 'http' ? 'http' : 'https';

  const requestOrigin = (forwardedHost || host)
    ? `${proto}://${forwardedHost || host}`.replace(/\/+$/, '')
    : '';
  const configuredSiteUrl = String(config.public.siteUrl || '').trim().replace(/\/+$/, '');
  const siteUrl = requestOrigin || configuredSiteUrl || DEFAULT_SITE_URL;

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600');
  return BODY.replace('__SITE_URL__', siteUrl);
});
