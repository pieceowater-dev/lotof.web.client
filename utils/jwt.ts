// Reads a claim out of a JWT payload without verifying the signature — the
// token is already verified server-side on every request; this is purely
// for client-side UI decisions (e.g. hiding a nav item a role can't use),
// never a security boundary by itself.
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
