import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// Plain Vitest, not @nuxt/test-utils -- most of tests/unit is pure TS
// (utils/, or composables with no Nuxt auto-imports), so the full Nuxt test
// environment isn't needed yet. Component tests (@vue/test-utils, e.g.
// StaffRoleModal.spec.ts) need @vitejs/plugin-vue to transform .vue SFCs at
// all -- without it Vite can't even parse the file, let alone mount it.
// Vue's own reactivity API (ref/computed/watch/...), which .vue files here
// rely on Nuxt to auto-import, is provided by tests/unit/setup.ts instead
// of unplugin-auto-import -- that package made @nuxt/schema's generated
// .nuxt/tsconfig.json include a compiler option this project's pinned
// TypeScript version doesn't recognize, breaking the required typecheck CI
// gate (see the comment in setup.ts for the full story). @nuxt/ui
// components aren't registered in this environment (no Nuxt runtime);
// those tests stub them with functional equivalents instead of pulling in
// @nuxt/test-utils' heavier Nuxt-environment bootstrap. Add a separate
// nuxt-environment config here if/when a composable test needs
// useState/useNuxtApp/etc for real.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // devDependencies pins jsdom to ^24.1.3, not latest: 25+ replaced its
    // CSS color parsing with @asamuzakjp/css-color, which require()s an
    // ESM-only @csstools/css-calc -- that crashes every test worker before
    // a single test runs (ERR_REQUIRE_ESM), regardless of Vitest's pool or
    // server.deps.inline config (jsdom loads at worker-environment setup,
    // outside Vite's transform pipeline). Don't bump past 24.x without
    // confirming that's fixed upstream.
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
