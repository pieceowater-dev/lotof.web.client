<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <!-- `min-h-0` lets these h-full-rooted workspace pages (menu/atrace/
         issues/contacts/goods/plans -- index AND settings) bound their own
         height and scroll internally, instead of overflowing under the
         footer like a normal auto-height page would. -->
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full flex flex-col pt-20 pb-safe-or-4">
      <!-- On phones the page is as tall as its content and the footer follows it (otherwise a long
           list ran under the footer). Atrace keeps its own fixed-height behaviour untouched. -->
      <div class="flex-1 min-h-0" :class="isAtrace ? '' : 'max-md:flex-none'">
        <slot />
      </div>
      <AppFooter variant="minimal" class="flex-shrink-0" />
    </main>
    <CallPopup />
    <CallPlayerWidget />
    <TourGuide />
    <CookieNotice />
    <ReauthPrompt />
  </div>
</template>

<script lang="ts" setup>
import AppHeader from '@/components/ui/AppHeader.vue';
import AppFooter from '@/components/ui/AppFooter.vue';
import CallPlayerWidget from '@/components/contacts/CallPlayerWidget.vue';
import CallPopup from '@/components/contacts/CallPopup.vue';
import TourGuide from '@/components/ui/TourGuide.vue';
import CookieNotice from '@/components/ui/CookieNotice.vue';
import ReauthPrompt from '@/components/ui/ReauthPrompt.vue';

const route = useRoute();
const isAtrace = computed(() => route.path.includes('/atrace'));

// H1: one of 3 layouts extracted verbatim from the old layouts/default.vue
// regex (git history), for the per-namespace app workspace pages themselves
// (not their /plans pricing sub-page, which uses layouts/quiet.vue instead).
// Minimal footer + min-h-0 internal scroll.
</script>
