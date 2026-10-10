// Visual feedback for the Google sign-in redirect: the button the user just clicked gets
// `data-login-pending`, which `surface.css` turns into a spinner (the Google logo / icons hide).
// The clicked element comes from a capture-phase click recorder (plugins/login-click.client.ts),
// because login() is called from many different buttons without an event.
const SELECTOR = '.cta-pill, .hdr-cta, .hdr-chip, .sf-btn, .sf-pill, .sf-chip, .sf-card, button, a';

let lastClick: { el: Element; at: number } | null = null;

export function recordLoginClick(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const el = target.closest(SELECTOR);
  if (el) lastClick = { el, at: Date.now() };
}

export function markLoginPending() {
  if (typeof document === 'undefined') return;
  const hit = lastClick && Date.now() - lastClick.at < 1500 ? lastClick.el : null;
  if (!hit) return; // programmatic login (auto-login): nothing was clicked
  // A large clickable panel (home split cards): spin its call-to-action instead of the whole card.
  const el = hit.getAttribute('role') === 'button' ? (hit.querySelector('.cta-pill') || hit) : hit;
  el.setAttribute('data-login-pending', '1');
  el.setAttribute('aria-busy', 'true');
}

export function clearLoginPending() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-login-pending]').forEach((n) => {
    n.removeAttribute('data-login-pending');
    n.removeAttribute('aria-busy');
  });
}
