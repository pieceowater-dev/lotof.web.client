# 0003: One `layouts/default.vue` for marketing + workspace + console, chosen by path regex

**Status:** accepted as historical, superseded — this one *is* a mistake, kept documented so the fix isn't repeated

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

The fix (`FRONTEND_AUDIT.md` H1) is `layouts/marketing.vue` /
`workspace.vue` / `console.vue`, with pages choosing via
`definePageMeta({ layout: 'workspace' })`, and the 13 `layout: false`
pages becoming a `layout: 'bare'` instead. Not done yet — it's rated 🟨 in
the audit specifically because the three regexes encode real, sometimes
non-obvious accumulated behavior, and porting them has to be done
line-by-line against their own comments, then checked by eye on at least
`/`, `/hub`, `/catalog`, `/console/*`, `/{ns}/menu`, `/{ns}/bundles`,
`/{ns}/menu/plans` (the last two are exactly where the footer broke
before).

## Consequences

- New routes should still go through `QUIET_FOOTER`/`WORKSPACE_PAGE`/
  `PRICING_PAGE` today — that's still the live mechanism — but be aware
  it's slated for replacement, not a pattern to extend further if
  avoidable.
- When the H1 migration happens, do it as its own dedicated pass with the
  manual route checklist above, not bundled into an unrelated change.
