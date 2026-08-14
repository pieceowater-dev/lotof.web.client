<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { useAppInstallStatus } from '@/composables/useAppInstallStatus';
import { useConsoleAccess } from '@/composables/useConsoleAccess';
import { useImpersonation } from '@/composables/useImpersonation';
import GuideWidget from '@/components/guide/GuideWidget.vue';

const { t } = useI18n();
const toast = useToast();
const router = useRouter();
const route = useRoute();

const { isLoggedIn, login, user, token } = useAuth();
const { selected: selectedNS } = useNamespace();
const routeNamespace = computed(() => (route.params.namespace as string) || '');
const currentNamespace = computed(() => selectedNS.value || routeNamespace.value);
// Same source of truth the home page dashboard uses -- a header button for
// an app the namespace hasn't subscribed to must land on that app's plan
// picker, exactly like clicking the dashboard tile does, not straight into
// a half-broken unsubscribed app page.
const { resolveAppDestination, ensureAppInstallStatus } = useAppInstallStatus();
watch(currentNamespace, (ns) => {
  if (ns) ensureAppInstallStatus(ns);
}, { immediate: true });

const { isImpersonating, exitImpersonation } = useImpersonation();
const impersonating = computed(() => isImpersonating());
const exitingImpersonation = ref(false);
async function onExitImpersonation() {
  if (exitingImpersonation.value) return;
  exitingImpersonation.value = true;
  await exitImpersonation();
  window.location.href = '/';
}

const { canSeeConsole, refreshConsoleAccess } = useConsoleAccess();
watch(
  () => [isLoggedIn.value, user.value?.id, token.value],
  () => refreshConsoleAccess(),
  { immediate: true }
);
function handleConsoleClick() {
  isMobileMenuOpen.value = false;
  router.push('/console');
}

// Rolled client-side only, after mount: Math.random() evaluated during SSR
// and again during client hydration are two independent rolls, and roughly
// 1 in 11 page loads would land on different outcomes -- a real, frequent
// hydration mismatch, not just a rare edge case. Defaulting to the normal
// text through hydration and only swapping in the easter egg afterward
// keeps the server/client render identical where it's compared.
const isWalter = ref(false);
onMounted(() => {
  isWalter.value = Math.random() < 1 / 1000;
});
const homeText = computed(() => isWalter.value ? 'Домой, Уолтер' : t('app.home'));
// Fixed order everywhere (see config/apps.ts) -- matches the home
// dashboard's tile order exactly, regardless of what's installed.
const navApps = computed(() => ALL_APPS);
// The Home button used to disappear once you were already on '/' -- now it
// just stays put and highlights instead, so the nav bar doesn't visibly
// reflow depending on which page you're on.
const showHomeItem = computed(() => true);
const isHomeActive = computed(() => route.path === '/');
const isMobileMenuOpen = ref(false);
const shouldUseBurger = ref(true);
const headerInnerRef = ref<HTMLElement | null>(null);
const brandRef = ref<HTMLElement | null>(null);
const desktopMeasureRef = ref<HTMLElement | null>(null);
const desktopHelpMeasureRef = ref<HTMLElement | null>(null);
let headerResizeObserver: ResizeObserver | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

// Гид -- единая кнопка на всех страницах, открывает GuideWidget (тур
// запускается изнутри виджета, а не напрямую по клику на кнопку).
const showHelpButton = computed(() => true);
const isGuideOpen = ref(false);

function handleHelpClick() {
  isGuideOpen.value = true;
}

function handleHomeClick() {
  isMobileMenuOpen.value = false;
  router.push('/');
}

function handleMenuSelect(app: AppConfig) {
  if (!app.canAdd) {
    toast.add({
      title: t('app.comingSoonToast') || 'Скоро станет доступным!',
      color: 'gray',
    });
    return;
  }
  if (!isLoggedIn.value) return login();
  const ns = currentNamespace.value;
  if (!ns) return;

  isMobileMenuOpen.value = false;
  router.push(resolveAppDestination(app, ns));
}

function isAppActive(app: AppConfig) {
  return route.path.includes(`/${app.address}`);
}

function debouncedUpdateMenuMode() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateMenuMode();
    resizeTimeout = null;
  }, 100);
}

function updateMenuMode() {
  const headerInner = headerInnerRef.value;
  const brand = brandRef.value;
  const desktopMeasure = desktopMeasureRef.value;

  if (!headerInner || !brand || !desktopMeasure) {
    shouldUseBurger.value = true;
    return;
  }

  const reservedSpacing = showHelpButton.value ? 40 : 24;
  const availableWidth = headerInner.clientWidth - brand.offsetWidth - reservedSpacing;
  const helpWidth = showHelpButton.value ? (desktopHelpMeasureRef.value?.offsetWidth ?? 0) + 8 : 0;
  const requiredWidth = desktopMeasure.scrollWidth + helpWidth;

  shouldUseBurger.value = requiredWidth > Math.max(availableWidth, 0);
}

async function syncMenuMode() {
  await nextTick();
  debouncedUpdateMenuMode();
}

onMounted(() => {
  syncMenuMode();

  headerResizeObserver = new ResizeObserver(() => {
    debouncedUpdateMenuMode();
  });

  if (headerInnerRef.value) headerResizeObserver.observe(headerInnerRef.value);
  if (brandRef.value) headerResizeObserver.observe(brandRef.value);
  if (desktopMeasureRef.value) headerResizeObserver.observe(desktopMeasureRef.value);
  if (desktopHelpMeasureRef.value) headerResizeObserver.observe(desktopHelpMeasureRef.value);
});

onBeforeUnmount(() => {
  headerResizeObserver?.disconnect();
  headerResizeObserver = null;
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = null;
});

watch(
  () => [route.fullPath, showHomeItem.value, showHelpButton.value, canSeeConsole.value],
  () => {
    syncMenuMode();
  }
);

const goHome = () => {
  router.push('/');
};
</script>

<template>
  <!-- blur strip covering the top gap above the floating header -->
  <div class="fixed top-0 left-0 right-0 h-3 z-50 backdrop-blur-sm pointer-events-none" />
  <header
    class="fixed top-3 left-2 right-2 z-50 rounded-3xl border border-blue-100/80 bg-white/90 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/90"
  >
    <div
      ref="headerInnerRef"
      class="flex w-full items-center justify-between px-4 py-2 md:px-5 md:py-2 lg:px-6"
    >
      <div
        v-if="impersonating"
        class="flex items-center gap-2 shrink-0 rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      >
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        <span class="max-w-[10rem] truncate text-xs font-medium md:max-w-xs md:text-sm">{{ user?.email || user?.username }}</span>
        <button
          type="button"
          class="shrink-0 text-amber-700 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white"
          :disabled="exitingImpersonation"
          @click="onExitImpersonation"
        >
          <Icon name="lucide:x" class="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        v-else
        ref="brandRef"
        class="flex items-center space-x-1 cursor-pointer shrink-0"
        @click="goHome"
      >
        <picture>
          <source srcset="/assets/logo.webp" type="image/webp">
          <img
            src="/assets/logo.png"
            alt="Logo"
            width="20"
            height="20"
            class="h-5 w-5"
          >
        </picture>
        <span class="text-base md:text-lg">lota</span>
      </div>

      <div
        v-if="!shouldUseBurger"
        class="flex min-w-0 flex-1 items-center justify-end gap-2 pl-4 md:pl-5 lg:pl-6"
      >
        <nav class="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto">
          <button
            v-if="showHomeItem"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="isHomeActive
              ? 'border-transparent bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700/60'"
            @click="handleHomeClick"
          >
            <UIcon
              name="i-lucide-home"
              class="h-4 w-4"
            />
            <span class="truncate">{{ homeText }}</span>
          </button>

          <button
            v-if="canSeeConsole"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700/60"
            @click="handleConsoleClick"
          >
            <UIcon
              name="lucide:terminal-square"
              class="h-4 w-4"
            />
            <span class="truncate">Console</span>
          </button>

          <button
            v-for="app in navApps"
            :key="app.bundle"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="[
              isAppActive(app)
                ? 'border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-primary-300'
                : 'border-transparent bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700/60',
              !isAppActive(app) && (app.canAdd ? 'text-gray-700 hover:text-primary dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'),
            ]"
            :aria-disabled="!app.canAdd"
            @click="handleMenuSelect(app)"
          >
            <UIcon
              :name="app.icon"
              class="h-4 w-4"
            />
            <span class="truncate">{{ t(app.titleKey) }}</span>
          </button>
        </nav>

        <UButton
          v-if="showHelpButton"
          data-tour="help-button"
          variant="ghost"
          size="sm"
          :aria-label="t('guide.openGuide') || 'Open lota Гид'"
          :title="t('guide.openGuide') || 'Open lota Гид'"
          @click="handleHelpClick"
        >
          <UIcon name="i-lucide-life-buoy" />
        </UButton>
      </div>

      <div
        v-if="shouldUseBurger"
        class="flex shrink-0 items-center gap-1 pl-4"
      >
        <UButton
          v-if="showHelpButton"
          data-tour="help-button"
          variant="ghost"
          size="sm"
          :aria-label="t('guide.openGuide') || 'Open lota Гид'"
          :title="t('guide.openGuide') || 'Open lota Гид'"
          @click="handleHelpClick"
        >
          <UIcon name="i-lucide-life-buoy" />
        </UButton>

        <UButton
          variant="ghost"
          size="sm"
          :aria-label="t('app.feedMenu') || 'Open menu'"
          @click="isMobileMenuOpen = true"
        >
          <UIcon name="i-lucide-menu" />
        </UButton>
      </div>
    </div>

    <div class="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
      <div class="flex items-center gap-2 whitespace-nowrap">
        <div
          ref="desktopMeasureRef"
          class="flex items-center gap-2"
        >
          <button
            v-if="showHomeItem"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            <UIcon
              name="i-lucide-home"
              class="h-4 w-4"
            />
            <span>{{ homeText }}</span>
          </button>

          <button
            v-if="canSeeConsole"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            <UIcon
              name="lucide:terminal-square"
              class="h-4 w-4"
            />
            <span>Console</span>
          </button>

          <button
            v-for="app in navApps"
            :key="`measure-${app.bundle}`"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            <UIcon
              :name="app.icon"
              class="h-4 w-4"
            />
            <span>{{ t(app.titleKey) }}</span>
          </button>
        </div>

        <div
          v-if="showHelpButton"
          ref="desktopHelpMeasureRef"
          class="flex shrink-0"
        >
          <UButton
            variant="ghost"
            size="sm"
          >
            <UIcon name="i-lucide-life-buoy" />
          </UButton>
        </div>
      </div>
    </div>
  </header>

  <!-- blur strip covering the bottom gap below the floating sheet -->
  <div
    v-if="isMobileMenuOpen"
    class="fixed bottom-0 left-0 right-0 h-3 z-[60] backdrop-blur-sm pointer-events-none"
  />

  <UModal
    v-model="isMobileMenuOpen"
    class="menu-bottom-sheet"
    :transition="false"
    :ui="{
      container: 'items-end pb-3 px-2',
      base: 'w-full rounded-3xl backdrop-blur-md bg-white/90 dark:bg-gray-800/90 border border-blue-100/80 dark:border-gray-700 shadow-sm'
    }"
  >
    <div class="p-4 max-h-[80vh] overflow-auto">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-base font-semibold">
          {{ t('app.apps') }}
        </h3>
        <UButton
          variant="ghost"
          icon="lucide:x"
          :aria-label="t('app.cancel') || 'Close menu'"
          @click="isMobileMenuOpen = false"
        />
      </div>

      <div class="space-y-2">
        <button
          v-if="showHomeItem"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
          :class="isHomeActive ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="handleHomeClick"
        >
          <UIcon
            name="i-lucide-home"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="text-sm font-medium truncate" :class="isHomeActive && 'text-primary'">{{ homeText }}</span>
        </button>

        <button
          v-if="canSeeConsole"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="handleConsoleClick"
        >
          <UIcon
            name="lucide:terminal-square"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="flex-1 text-sm font-medium truncate">Console</span>
        </button>

        <button
          v-for="app in navApps"
          :key="app.bundle"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          :class="{ 'text-gray-400 dark:text-gray-500': !app.canAdd }"
          :aria-disabled="!app.canAdd"
          @click="handleMenuSelect(app)"
        >
          <UIcon
            :name="app.icon"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="flex-1 text-sm font-medium truncate">{{ t(app.titleKey) }}</span>
        </button>
      </div>
    </div>
  </UModal>

  <GuideWidget v-model="isGuideOpen" />
</template>