// Nuxt auto-imports ref/computed/watch/etc from 'vue' at build time, so
// .vue components in this repo have no explicit `import { computed } from
// 'vue'` line. Reproducing that transform via unplugin-auto-import turned
// out to have a real side effect (2026-09-11): installing it made
// @nuxt/schema's generated .nuxt/tsconfig.json include `libReplacement`, a
// TypeScript 5.8+-only compiler option this project's pinned
// typescript@5.7.3 doesn't recognize -- `npm run typecheck` (a required CI
// gate) failed outright with `error TS5023: Unknown compiler option
// 'libReplacement'`, confirmed reproducible via a clean `.nuxt` regen and
// isolated to that one package by uninstalling it and re-testing. Not worth
// chasing why through unplugin-auto-import's dependency tree -- this
// achieves the same thing (Vue's reactivity API available as globals to
// mounted components) without a build-time transform at all.
import * as vue from 'vue';

Object.assign(globalThis, vue);
