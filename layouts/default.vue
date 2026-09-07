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
      <AppFooter :variant="footerVariant" class="flex-shrink-0" />
    </main>
    <TourGuide />
    <CookieNotice />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// In-app workspace + console screens get the quiet one-line footer; every
// public / marketing / content route gets the full four-column footer.
const IN_APP = /^\/(console(\/|$)|[^/]+\/(menu|atrace|issues|contacts|goods|bundles|plans)(\/|$))/;

const footerVariant = computed<'full' | 'minimal'>(() =>
  IN_APP.test(route.path) ? 'minimal' : 'full',
);
</script>
