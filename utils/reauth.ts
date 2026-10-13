// Sensitive actions (telephony secrets and settings, for now) need a Google
// sign-in made in the last few minutes. The server answers with the error code
// REAUTH_REQUIRED; this tells the app to ask the person to confirm.
export const REAUTH_EVENT = 'lota:reauth-required';

export function isReauthRequired(e: unknown): boolean {
  const err = e as any;
  const errors = err?.response?.errors;
  if (Array.isArray(errors) && errors.some((x: any) => x?.extensions?.code === 'REAUTH_REQUIRED')) return true;
  return typeof err?.message === 'string' && err.message.includes('reauth_required');
}

/** Tells the app to show the "confirm your sign-in" prompt (no-op on the server). */
export function requestReauth() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REAUTH_EVENT));
}
