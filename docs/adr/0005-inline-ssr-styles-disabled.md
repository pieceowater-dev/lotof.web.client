# 0005: `experimental.inlineSSRStyles: false`

**Status:** accepted

## Context

Nuxt's default behavior inlines each page's "critical" CSS as a `<style>`
block directly in the server-rendered HTML, to avoid a render-blocking
stylesheet request. In this app that default measured out to inlining
~200 KiB of `<style>` per page — most of the app's *entire* CSS footprint,
not a critical subset — shipped uncached on every single page load.

## Decision

`nuxt.config.ts` sets `experimental.inlineSSRStyles: false` (with a
`@ts-expect-error` next to it — the option is real and functioning, the
installed `@nuxt/schema` version's shipped types just don't declare it;
confirmed by grepping the installed type declarations, not assumed) so
CSS is served as a normal external stylesheet instead. Paired with the
`/_nuxt/**` route rule's year-long `cache-control: public, max-age=31536000,
immutable`, this means the browser fetches the CSS once and reuses it
across every page on the site, instead of re-downloading a large inline
block on every navigation.

## Consequences

- Don't re-enable the default inlining without re-measuring the actual
  critical-CSS size first — the number that justified this
  (~200 KiB/page) is what made the tradeoff worth it.
- If `inlineSSRStyles` ever shows up in `@nuxt/schema`'s types after a
  Nuxt upgrade, the `@ts-expect-error` comment should be removed (it'll
  fail typecheck on its own once the suppression is no longer needed,
  which is the intended signal to notice and clean it up).
- Revisit alongside `FRONTEND_AUDIT.md` B1 (`onMounted` → `useAsyncData`
  migration) and K4 (`renderJsonPayloads`/`payloadExtraction`) — all
  three are part of the same "what actually goes into the initial HTML"
  tradeoff and are worth reassessing together once SSR data-fetching
  changes.
