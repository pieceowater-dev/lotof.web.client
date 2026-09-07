<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full pt-20 pb-safe-or-4">
      <slot />
      <AppFooter :variant="footerVariant" />
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
