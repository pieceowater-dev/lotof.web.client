<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { useOnboarding } from '@/composables/useOnboarding';
import { atraceTour, contactsTour } from '@/config/tours';

const { t } = useI18n();
const toast = useToast();
const router = useRouter();
const route = useRoute();

const { isLoggedIn, login } = useAuth();
const { selected: selectedNS } = useNamespace();
const routeNamespace = computed(() => (route.params.namespace as string) || '');
const currentNamespace = computed(() => selectedNS.value || routeNamespace.value);

const isWalter = Math.random() < 1 / 21;
const homeText = computed(() => isWalter ? 'Домой, Уолтер' : t('app.home'));
const isAtraceRoute = computed(() => route.path.includes('/atrace'));
const isContactsListRoute = computed(() => /\/contacts\/(all|individual|legal)\//.test(route.path));
const navApps = computed(() => ALL_APPS);
const showHomeItem = computed(() => route.path !== '/');
const isMobileMenuOpen = ref(false);
const shouldUseBurger = ref(true);
const headerInnerRef = ref<HTMLElement | null>(null);
const brandRef = ref<HTMLElement | null>(null);
const desktopMeasureRef = ref<HTMLElement | null>(null);
const desktopHelpMeasureRef = ref<HTMLElement | null>(null);
let headerResizeObserver: ResizeObserver | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

// Onboarding
const { startTour, reset } = useOnboarding();
const showHelpButton = computed(() => {
  return isAtraceRoute.value || isContactsListRoute.value;
});

function handleHelpClick() {
  if (isAtraceRoute.value) {
    reset(atraceTour.id);
    startTour(atraceTour, 0);
    return;
  }

  if (isContactsListRoute.value) {
    reset(contactsTour.id);
    startTour(contactsTour, 0);
  }
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
  router.push(`/${ns}/${app.address}`);
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
  () => [route.fullPath, showHomeItem.value, showHelpButton.value],
  () => {
    syncMenuMode();
  }
);

const goHome = () => {
  router.push('/');
};
</script>

<template>
  <header
    class="fixed top-3 left-2 right-2 z-50 rounded-3xl border border-blue-100/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div
      ref="headerInnerRef"
      class="flex w-full items-center justify-between px-4 py-2 md:px-5 md:py-3 lg:px-6"
    >
      <div
        ref="brandRef"
        class="flex items-center space-x-1 cursor-pointer shrink-0"
        @click="goHome"
      >
        <img
          src="/assets/logo.png"
          alt="Logo"
          class="h-5 w-5"
        >
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
            :class="'border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700/60'"
            @click="handleHomeClick"
          >
            <UIcon
              name="i-lucide-home"
              class="h-4 w-4"
            />
            <span class="truncate">{{ homeText }}</span>
          </button>

          <button
            v-for="app in navApps"
            :key="app.bundle"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="isAppActive(app)
              ? 'border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-primary-300'
              : app.canAdd
                ? 'border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700/60'
                : 'border-transparent bg-transparent text-gray-400 dark:text-gray-500'"
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
          :aria-label="t('app.startTour') || 'Start interactive tutorial'"
          :title="t('app.startTour') || 'Start interactive tutorial'"
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
          :aria-label="t('app.startTour') || 'Start interactive tutorial'"
          :title="t('app.startTour') || 'Start interactive tutorial'"
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

  <UModal
    v-model="isMobileMenuOpen"
    class="menu-bottom-sheet"
    :transition="false"
    :ui="{
      container: 'items-end',
      base: 'w-full rounded-t-2xl'
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
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="handleHomeClick"
        >
          <UIcon
            name="i-lucide-home"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="text-sm font-medium truncate">{{ homeText }}</span>
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
</template>