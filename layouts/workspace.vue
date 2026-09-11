<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <!-- `min-h-0` lets these h-full-rooted workspace pages (menu/atrace/
         issues/contacts/goods/plans -- index AND settings) bound their own
         height and scroll internally, instead of overflowing under the
         footer like a normal auto-height page would. -->
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full flex flex-col pt-20 pb-safe-or-4">
      <div class="flex-1 min-h-0">
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
// regex (git history), for the per-namespace app workspace pages themselves
// (not their /plans pricing sub-page, which uses layouts/quiet.vue instead).
// Minimal footer + min-h-0 internal scroll.
</script>
