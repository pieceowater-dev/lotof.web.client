# 0004: Hand-rolled `useI18n()` instead of `@nuxtjs/i18n`

**Status:** accepted as-is; costs are known and documented, not silently absorbed

## Context

`composables/useI18n.ts` implements translation lookup itself rather than
using `@nuxtjs/i18n`. This gives up things the module provides for free:
localized routing, `hreflang`/SEO, lazy locale loading (today `ru.json`,
`en.json`, `kk.json` are all statically imported into every bundle),
type-safe keys, standard pluralization.

## Decision

No single commit or comment in the codebase explains why the module was
skipped — this ADR exists to stop that context from disappearing further,
not to defend the choice as obviously correct. What's documented instead
is the actual, verified behavior of the home-grown implementation, since
the first pass of `FRONTEND_AUDIT.md` described it incorrectly:

`t()` (`composables/useI18n.ts:98-120`) falls through **all three**
locales in order and only returns `''` if the key exists in **none** of
them. A key present in `ru` but missing in `kk` does not render blank —
it silently renders the **Russian text** to a Kazakh-locale reader. That's
the real shape of the i18n-drift problem (`FRONTEND_AUDIT.md` I2: 337 keys
missing from `ru`, 581 from `en`, 1291 from `kk`, out of a 3504-key
union) — wrong-language text on ~37% of Kazakh-locale keys, not empty UI.

## Consequences

- Don't assume a missing key shows as visibly blank when reasoning about
  i18n bugs in this app — check `npm run locales:check` instead.
- Minimum viable improvement without a full migration
  (`FRONTEND_AUDIT.md` I1): log a warning in dev when the *primary*
  locale specifically is missing a key (not just when all three miss it),
  and generate a key-typed union from `ru.json` so a typo in a `t('...')`
  call is a compile error.
- Full migration to `@nuxtjs/i18n` remains on the table but changes
  routing behavior (locale-prefixed URLs) app-wide — treat it as its own
  project with its own route-by-route verification pass, not a drop-in
  swap.
