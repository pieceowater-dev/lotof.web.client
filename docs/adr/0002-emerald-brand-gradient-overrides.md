# 0002: `global.css` overrides every `emerald-*` Tailwind utility with `!important`

**Status:** accepted as-is for now; migration path defined, not executed

## Context

`assets/css/global.css` has 31 `!important` rules like:

```css
[class*="bg-emerald-"] { background-image: var(--accent-gradient-soft) !important }
[class*="text-emerald-"] { /* gradient text */ }
[class*="from-emerald-"] { /* stop override */ }
```

This breaks Tailwind's contract: writing `bg-emerald-600` anywhere in the
app does not render solid emerald — it silently renders the brand
gradient instead. Getting an actual solid emerald requires the workaround
`bg-gradient-to-r from-emerald-500 to-emerald-600`, which has bitten real
features twice (the WhatsApp button, the cash-payment modal).

## Decision

The brand's signature gradient was introduced by making every `emerald-*`
utility class resolve to it globally, rather than by introducing a
dedicated `accent`/`brand-gradient` token from the start. It's now woven
through the whole UI this way — removing the override wholesale
recolors every `emerald-*` element in the app at once, including screens
nobody opens during a manual check. That's not a refactor, it's a full
visual regression risk, so it's deliberately left in place rather than
"fixed" reactively.

## Consequences

- **Do not remove these overrides in one commit.** `grep -r 'emerald-'
  components pages` is non-zero and stays that way until the migration
  below is actually done.
- Migration path, in order (`FRONTEND_AUDIT.md` G1/G3):
  1. Add a real `tailwind.config.{ts,js}` (doesn't exist today — the
     build log confirms `[nuxt:tailwindcss] Using default Tailwind CSS
     file`) with `theme.extend.colors.accent` backed by a CSS variable,
     plus a `.brand-gradient` class for the gradient itself.
  2. Migrate screens onto `accent`/`.brand-gradient` one at a time.
  3. Remove the `global.css` overrides only once no `emerald-*` class
     remains in `components`/`pages`.
- Until then: a normal `emerald-*` class will keep rendering the brand
  gradient everywhere, and that's expected, not a bug to chase.
