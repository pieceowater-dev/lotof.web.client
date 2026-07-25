// Referral links (domain.com/r/<namespace-slug>): tag the visitor with a
// cookie so a later signup can be attributed back to the referring namespace,
// then land on the home page. No validation against the backend here -- an
// unknown/stale slug just means no referral gets recorded at signup time (see
// hub.msvc.namespaces CreateNamespace), it doesn't need to dead-end the visitor.
export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code') || '').trim();
  if (!code) {
    return sendRedirect(event, '/', 307);
  }

  setCookie(event, 'referral_code', code, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days -- generous attribution window
    sameSite: 'lax',
    httpOnly: false, // read by client-side login() to carry through the OAuth redirect
  });

  return sendRedirect(event, '/', 307);
});
