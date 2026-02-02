<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS, type AppConfig } from '@/config/apps';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const { isLoggedIn, login } = useAuth();
const { selected: selectedNS } = useNamespace();
const routeNamespace = computed(() => (route.params.namespace as string) || '');
const currentNamespace = computed(() => selectedNS.value || routeNamespace.value);

const showMenuButton = computed(() => route.path !== '/');
const isMenuOpen = ref(false);
const isMobileMenuOpen = ref(false);

const isWalter = Math.random() < 1 / 21;
const homeText = computed(() => isWalter ? 'Домой, Уолтер' : t('app.home'));

function closeMenu(source: 'desktop' | 'mobile') {
  if (source === 'desktop') isMenuOpen.value = false;
  else isMobileMenuOpen.value = false;
}

function handleHomeClick(source: 'desktop' | 'mobile') {
  closeMenu(source);
  router.push('/');
}

function handleMenuSelect(app: AppConfig, source: 'desktop' | 'mobile') {
  closeMenu(source);
  
  if (!app.canAdd) return;
  if (!isLoggedIn.value) return login();
  const ns = currentNamespace.value;
  if (!ns) return;
  
  router.push(`/${ns}/${app.address}`);
}

watch(() => route.fullPath, () => {
  isMenuOpen.value = false;
  isMobileMenuOpen.value = false;
});

const goHome = () => {
  router.push('/');
};
</script>

<template>
  <header
    class="fixed top-0 left-0 w-full flex items-center justify-between p-2 md:p-3 px-2 md:px-4 bg-white dark:bg-gray-800 shadow-md z-50">
    <div class="flex items-center space-x-1 cursor-pointer" @click="goHome">
      <img src="/assets/logo.png" alt="Logo" class="h-5 w-5" />
      <span class="text-base md:text-lg">lota</span>
    </div>

    <div class="flex items-center gap-1">
      <!-- <UButton v-if="showMenuButton" @click="goHome" variant="ghost" size="md" md:size="lg">
        <UIcon name="i-lucide-home" />
      </UButton> -->

      <!-- Mobile burger -->
      <UButton class="md:hidden" @click="isMobileMenuOpen = true" variant="ghost" size="md">
        <UIcon name="i-lucide-menu" />
      </UButton>

      <!-- Desktop menu -->
      <UPopover v-model="isMenuOpen" class="hidden md:block" :popper="{ placement: 'bottom-end' }" mode="hover" :open-delay="0" :close-delay="200">
        <UButton variant="ghost" size="md" md:size="lg">
          <UIcon name="i-lucide-menu" />
        </UButton>
        <template #panel>
          <div class="w-[520px] max-w-[90vw] p-4">
            <div class="space-y-2">
              <button
                v-if="route.path !== '/'"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                @click="handleHomeClick('desktop')"
              >
                <UIcon name="i-lucide-home" class="w-5 h-5 text-primary flex-shrink-0" />
                <span class="text-sm font-medium truncate">{{ homeText }}</span>
              </button>

              <button
                v-for="app in ALL_APPS"
                :key="app.bundle"
                v-show="!route.path.includes('/' + app.address)"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                :class="{ 'opacity-60': !app.canAdd, 'cursor-not-allowed': !app.canAdd }"
                @click="handleMenuSelect(app, 'desktop')"
              >
                <UIcon :name="app.icon" class="w-5 h-5 text-primary flex-shrink-0" />
                <span class="text-sm font-medium truncate">{{ t(app.titleKey) }}</span>
              </button>
            </div>
          </div>
        </template>
      </UPopover>
    </div>
  </header>

  <!-- Mobile bottom-sheet menu -->
  <UModal
    v-model="isMobileMenuOpen"
    class="menu-bottom-sheet"
    :ui="{
      container: 'items-end',
      base: 'w-full rounded-t-2xl'
    }"
  >
    <div class="p-4 max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold">{{ t('app.apps') }}</h3>
        <UButton variant="ghost" icon="lucide:x" @click="isMobileMenuOpen = false" />
      </div>

      <div class="space-y-2">
        <button
          v-if="route.path !== '/'"
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="handleHomeClick('mobile')"
        >
          <UIcon name="i-lucide-home" class="w-5 h-5 text-primary flex-shrink-0" />
          <span class="text-sm font-medium truncate">{{ homeText }}</span>
        </button>

        <button
          v-for="app in ALL_APPS"
          :key="app.bundle"
          v-show="!route.path.includes('/' + app.address)"
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          :class="{ 'opacity-60': !app.canAdd, 'cursor-not-allowed': !app.canAdd }"
          @click="handleMenuSelect(app, 'mobile')"
        >
          <UIcon :name="app.icon" class="w-5 h-5 text-primary flex-shrink-0" />
          <span class="text-sm font-medium truncate">{{ t(app.titleKey) }}</span>
        </button>
      </div>
    </div>
  </UModal>
</template>