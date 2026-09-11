import type { Config } from 'tailwindcss'

// G1/G3 (FRONTEND_AUDIT.md), phase 1 of the plan the audit itself lays out:
// "(1) introduce accent tokens in parallel, without touching the overrides;
// (2) migrate screens to them one at a time; (3) remove the overrides once
// no emerald-* remains in templates (grep -r 'emerald-' components pages =
// 0). Not in one commit."
//
// This file is ONLY step (1). It adds a semantic `accent` color (flat, for
// new/migrated call sites) alongside the brand-gradient look the emerald
// overrides in global.css already force onto every existing emerald-*/
// green-* usage (text, background, icons, gradient stops, border, ring --
// see the "Global accent remap" block there). Nothing here touches those
// overrides or any of the 687 existing emerald-*/green-* call sites across
// 82 files (measured 2026-09-11) -- steps (2)/(3) are a real, multi-file
// design migration (deciding, place by place, whether the *gradient* look
// or a *flat* accent color is the right replacement), not a mechanical
// rename, and stay out of scope for this pass.
//
// No `content` array here deliberately -- @nuxtjs/tailwindcss (loaded via
// @nuxt/ui) computes its own content globs from the project's actual file
// layout regardless of whether a user config exists, and deep-merges this
// file into its own generated config rather than replacing it. Verified
// empirically before committing to this: same rendered CSS before/after
// (screenshot-compared home page + tailwind class-count check), not just
// assumed from the module's docs.
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        // rgb(var(...) / <alpha-value>) is Tailwind's own convention for a
        // CSS-variable-backed color that still supports opacity modifiers
        // (accent-500/50 etc.). Channels match global.css's existing
        // --accent-gradient start stop (rgb(37 99 235), the blue end) --
        // same brand blue, just also addressable as a flat Tailwind color
        // for spots that shouldn't render as a gradient.
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          50: 'rgb(var(--color-accent-50) / <alpha-value>)',
          100: 'rgb(var(--color-accent-100) / <alpha-value>)',
          500: 'rgb(var(--color-accent-500) / <alpha-value>)',
          600: 'rgb(var(--color-accent-600) / <alpha-value>)',
          700: 'rgb(var(--color-accent-700) / <alpha-value>)',
        },
      },
    },
  },
}
