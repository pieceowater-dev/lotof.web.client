import { getApiBaseUrl } from '../../../utils/api-base';

type ResolveDeepLinkResponse = {
  data?: {
    resolveDeepLink?: {
      found?: boolean;
      target?: string | null;
      code?: string | null;
    };
  };
  errors?: Array<{ message?: string }>;
};

const RESOLVE_DEEP_LINK_QUERY = `
  query ResolveDeepLink($code: String!) {
    resolveDeepLink(code: $code) {
      found
      target
      code
    }
  }
`;

// Short attribution links (domain.com/l/<code>): resolve the code against
// hub.gtw (which also atomically bumps its click counter), tag the visitor
// with a cookie so a later signup / app install can be attributed back to
// it, then land on the home page. An unknown/expired code still redirects
// home rather than 404ing -- a bad marketing link shouldn't dead-end a visitor.
export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code') || '').trim();
  if (!code) {
    return sendRedirect(event, '/', 307);
  }

  const forwardedHost = String(getHeader(event, 'x-forwarded-host') || '').trim();
  const host = String(getHeader(event, 'host') || '').trim();
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '').trim().toLowerCase();
  const proto = forwardedProto === 'https' ? 'https' : 'http';
  const requestOrigin = (forwardedHost || host) ? `${proto}://${forwardedHost || host}`.replace(/\/$/, '') : '';
  const hubUrl = String(getApiBaseUrl('hub') || '').replace(/\/$/, '');
  const envHub = String(process.env.VITE_API_HUB || '').trim().replace(/\/$/, '');
  const localDevHub = process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8080' : '';

  const endpointCandidates = [
    requestOrigin ? `${requestOrigin}/api-hub/query` : '',
    localDevHub ? `${localDevHub}/query` : '',
    envHub ? `${envHub}/query` : '',
    `${hubUrl}/query`,
  ].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

  let found = false;

  for (const endpoint of endpointCandidates) {
    try {
      const res = await $fetch<ResolveDeepLinkResponse>(endpoint, {
        method: 'POST',
        body: { query: RESOLVE_DEEP_LINK_QUERY, variables: { code } },
      });
      if (res?.errors?.length) throw new Error(res.errors[0]?.message || 'resolveDeepLink failed');
      found = Boolean(res?.data?.resolveDeepLink?.found);
      break;
    } catch {
      // Try next endpoint candidate.
    }
  }

  if (found) {
    setCookie(event, 'lead_ref', code, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days -- generous attribution window
      sameSite: 'lax',
      httpOnly: false, // read by client-side login() to carry through the OAuth redirect
    });
  }

  // `target` (home vs. a specific product) is reserved for a future
  // per-product landing page -- every deep link lands on home today.
  return sendRedirect(event, found ? `/?ref=${encodeURIComponent(code)}` : '/', 307);
});
