// Shared Nuxt UI `ui` overrides for the A-Trace modals (see DESIGN.md §10a/§10d).
// Spread them into a UModal / UCard `:ui` and add `class="at-modal"` to the UModal so the
// teleported content picks up the global `.at-modal` form/button skin from assets/css/atrace.css.
export const atModalUi = {
  overlay: { background: 'bg-gray-900/30 dark:bg-gray-950/60 backdrop-blur-sm' },
  rounded: 'rounded-[2rem]',
  shadow: 'shadow-2xl',
}

export const atCardUi = {
  ring: 'ring-1 ring-black/5 dark:ring-white/10',
  rounded: 'rounded-[2rem]',
  shadow: 'shadow-none',
  background: 'bg-white dark:bg-[#1a1a1a]',
  divide: 'divide-y divide-slate-900/5 dark:divide-white/10',
  header: { padding: 'px-7 pt-6 pb-4 sm:px-8' },
  body: { padding: 'px-7 py-5 sm:px-8 sm:py-6' },
  footer: { padding: 'px-7 pt-4 pb-6 sm:px-8' },
}
