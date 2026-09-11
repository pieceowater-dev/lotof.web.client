import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Plain Vitest, not @nuxt/test-utils -- everything under tests/unit today is
// pure TS (utils/, or composables with no Nuxt auto-imports), so the full
// Nuxt test environment isn't needed yet. Add a separate nuxt-environment
// config here if/when a composable test needs useState/useNuxtApp/etc.
export default defineConfig({
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
  },
});
