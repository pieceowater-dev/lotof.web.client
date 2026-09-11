<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full flex flex-col pt-20 pb-safe-or-4">
      <div class="flex-1">
        <slot />
      </div>
      <AppFooter variant="minimal" class="flex-shrink-0" />
    </main>
    <TourGuide />
    <CookieNotice />
  </div>
</template>

<script lang="ts" setup>
// H1: one of 3 layouts extracted verbatim from the old layouts/default.vue
// regex (git history), for /console/* and the per-namespace pricing
// sub-pages (/:ns/bundles, /:ns/<app>/plans). Minimal one-line footer, but
// normal auto-height scroll (no min-h-0) -- these are tall scrolling pages,
// not h-full workspace shells.
</script>
