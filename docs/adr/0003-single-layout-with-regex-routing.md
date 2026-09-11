# 0003: One `layouts/default.vue` for marketing + workspace + console, chosen by path regex

**Status:** superseded (`9e30df0`) — fixed, kept as a record of what the mistake was and why

## Context

`layouts/default.vue` decides footer style (full/minimal), `min-h-0`, and
scroll-container behavior via three regexes matched against `route.path`:
`QUIET_FOOTER`, `WORKSPACE_PAGE`, `PRICING_PAGE`. The file itself carries
several paragraphs of comments explaining why each regex is shaped the way
it is — including `PRICING_PAGE` being an exception carved out of
`WORKSPACE_PAGE`. `definePageMeta({ layout: ... })` is used 13 times in the
app, and all 13 of them are `layout: false` (opting *out* of the single
layout for `/to/*` storefronts, `atrace/qr`, `atrace/recorded`,
`atrace/post/[postid]`, `issues/zen`, `console/publications/*`,
`chekalka`) — no page ever *chooses* a layout, because there's only one to
choose from.

## Decision

Unlike the other ADRs in this set, this is **not** a decision to leave
alone — it's a documented case of what happens without per-audience
layouts from the start. The regex approach has already caused a real
"sticky footer" bug on `/plans` twice (see commit `0313857`), and the
pattern is inherently fragile: any new route added anywhere in the app has
to be checked against three regexes to know what its layout will do.

The fix (`FRONTEND_AUDIT.md` H1, shipped `9e30df0`) is 3 named layouts —
`layouts/full.vue` (full footer, normal scroll — marketing pages),
`layouts/quiet.vue` (minimal footer, normal scroll — `/console/*` and the
`/:ns/bundles` + `/:ns/<app>/plans` pricing sub-pages), `layouts/workspace.vue`
(minimal footer, `min-h-0` internal scroll — the app workspace pages
themselves) — with `definePageMeta({ layout: 'full' | 'quiet' | 'workspace' })`
set on all 68 pages that don't already opt out via `layout: false`. The
category for each page was computed by a small script running the *exact*
`QUIET_FOOTER`/`WORKSPACE_PAGE`/`PRICING_PAGE` regexes from the old
`layouts/default.vue` against that page's route pattern, rather than
re-guessed by eye — this guarantees the per-page assignment reproduces the
regex's own behavior instead of a fresh (and possibly wrong) reading of it.
The 13 `layout: false` pages were left untouched: `layout: false` is
already an explicit, correct choice for them (none of the 3 new layouts
fit a storefront/kiosk), so no separate `'bare'` layout was added.

`layouts/default.vue` itself was **not deleted** — it's left in place,
unused, as a zero-risk fallback for any future page that omits `layout:`.

Verified before deploy: typecheck/lint/test/build all green; a curl-based
structural check (footer `mt-6` vs `mt-12` class, `min-h-0` wrapper class
presence) against the built production server across all 3 categories and
every edge case named below, matching the old regex's predicted output
exactly; a Playwright hydration/console-error check run against both the
pre-change and post-change build, confirming the only warnings present
(an unrelated hydration notice and a connection-refused from a
backend call not reachable in this local preview) are identical on both,
i.e. pre-existing and not caused by this change.

## Consequences

- New routes now need an explicit `definePageMeta({ layout: ... })` (or
  `layout: false`) — there is no more automatic regex fallback in active
  use. `layouts/default.vue`'s regex is still there and still correct, but
  nothing references it anymore; treat it as a safety net, not something to
  keep extending.
- The three checked-in-and-verified route classes to keep in mind for any
  new page: `/`, `/hub`, `/catalog` (→ `full`); `/console/*`,
  `/{ns}/bundles`, `/{ns}/<app>/plans` (→ `quiet`); `/{ns}/<app>` and its
  sub-routes other than `/plans` (→ `workspace`).
