<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <!-- flex column + flex-1 on the content wrapper keeps the footer pinned to
         the bottom of the viewport even when a page's content is shorter than
         the screen, while still letting tall pages scroll normally. -->
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full flex flex-col pt-20 pb-safe-or-4">
      <!-- `min-h-0` lets a workspace page that opts into an `h-full` root
           (menu/goods/issues/contacts/atrace/plans — index AND settings)
           bound its own height and scroll internally. On a normal
           auto-height page it instead lets this box shrink *below* its
           content, so the content overflows and the footer (placed after
           the box) overlaps it — seen on /, /hub, /catalog and every
           /console/* page. So only the per-namespace workspace routes get
           `min-h-0`; console and everything else grow with their content. -->
      <div :class="['flex-1', isWorkspacePage ? 'min-h-0' : '']">
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

// Quiet one-line footer for in-app workspace + console screens; the full
// four-column footer everywhere else (public / marketing / content).
const QUIET_FOOTER = /^\/(console(\/|$)|[^/]+\/(menu|atrace|issues|contacts|goods|bundles|plans)(\/|$))/;

// `h-full`-rooted workspace pages that manage their own internal scroll —
// console pages are normal scrolling content and must NOT be in here (their
// footer was overlapping because of the shared min-h-0).
const WORKSPACE_PAGE = /^\/[^/]+\/(menu|atrace|issues|contacts|goods|plans)(\/|$)/;

// …but the tariff / bundle pricing pages that live under a namespace
// (`/ns/bundles`, `/ns/plans/plans`) are tall auto-height scrolling pages,
// NOT h-full shells — with min-h-0 the content box shrinks below its
// content and the footer rides up over it. Exclude them.
const PRICING_PAGE = /^\/[^/]+\/(bundles|plans\/plans)(\/|$)/;

const isWorkspacePage = computed(
  () => WORKSPACE_PAGE.test(route.path) && !PRICING_PAGE.test(route.path),
);

const footerVariant = computed<'full' | 'minimal'>(() =>
  QUIET_FOOTER.test(route.path) ? 'minimal' : 'full',
);
</script>
