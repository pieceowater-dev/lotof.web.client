<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <!-- flex column + flex-1 on the content wrapper keeps the footer pinned to
         the bottom of the viewport even when a page's content is shorter than
         the screen, while still letting tall pages scroll normally. -->
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full flex flex-col pt-20 pb-safe-or-4">
      <div class="flex-1">
        <slot />
      </div>
      <AppFooter variant="full" class="flex-shrink-0" />
    </main>
    <TourGuide />
    <CookieNotice />
  </div>
</template>

<script lang="ts" setup>
// H1: one of 3 layouts extracted verbatim from the old layouts/default.vue
// regex (git history), for pages outside any workspace app and outside
// /console -- marketing/public pages, plus the bare /:namespace page. Full
// four-column footer, normal auto-height scroll (no min-h-0).
</script>
