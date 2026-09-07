<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

// Project-wide footer. `full` is the marketing/content footer (product
// landings, guide, catalog, home); `minimal` is a single quiet strip for
// in-app / console routes where a four-column footer would be noise.
//
// Every link here opens in a new tab (target="_blank") on purpose: the
// footer shows up under real app/work screens, and a stray click on
// "Гид" or "Оферта" must never navigate the current tab away from what
// the user was doing.
const props = withDefaults(defineProps<{ variant?: 'full' | 'minimal' }>(), {
  variant: 'full',
});

const { t } = useI18n();
const year = new Date().getFullYear();

const products = [
  { to: '/issues', label: 'lota Issues' },
  { to: '/menu', label: 'lota Orders' },
  { to: '/contacts', label: 'lota Contacts' },
  { to: '/atrace', label: 'lota A-Trace' },
  { to: '/goods', label: 'lota Goods' },
];

const resources = computed(() => [
  { to: '/guide', label: t('guide.title') || 'Гид' },
  { to: '/catalog', label: t('home.title') || 'Каталог' },
  { to: '/news', label: t('footer.news') || 'Новости' },
]);

const legal = computed(() => [
  { to: '/guide/global/terms', label: t('legal.terms') || 'Пользовательское соглашение' },
  { to: '/guide/global/offer', label: t('legal.offer') || 'Публичная оферта' },
  { to: '/guide/global/privacy', label: t('legal.privacy') || 'Политика конфиденциальности' },
  { to: '/guide/global/personal-data', label: t('legal.personalData') || 'Обработка персональных данных' },
  { to: '/guide/global/cookies', label: t('legal.cookies') || 'Файлы cookie' },
]);

const legalShort = computed(() => [
  { to: '/guide', label: t('guide.title') || 'Гид' },
  { to: '/guide/global/terms', label: t('legal.terms') || 'Соглашение' },
  { to: '/guide/global/privacy', label: t('legal.privacy') || 'Конфиденциальность' },
  { to: '/guide/global/offer', label: t('legal.offer') || 'Оферта' },
]);

const socials = [
  { href: 'https://www.instagram.com/lota_tools', icon: 'simple-icons:instagram', label: 'Instagram' },
  { href: 'https://www.threads.com/@lota_tools', icon: 'simple-icons:threads', label: 'Threads' },
  { href: 'https://x.com/lota_tools', icon: 'simple-icons:x', label: 'X' },
];
</script>

<template>
  <!-- Minimal: one quiet line for in-app / console screens. -->
  <footer
    v-if="variant === 'minimal'"
    class="mt-6 w-full border-t border-gray-100 px-4 py-3 dark:border-gray-800"
  >
    <div class="mx-auto flex max-w-7xl flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
      <span class="text-xs text-gray-400 dark:text-gray-500">© {{ year }} lota — @pieceowater</span>
      <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
        <NuxtLink
          v-for="l in legalShort"
          :key="l.to"
          :to="l.to"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-gray-600 dark:hover:text-gray-300"
        >
          {{ l.label }}
        </NuxtLink>
      </div>
    </div>
  </footer>

  <!-- Full: marketing / content footer. -->
  <footer v-else class="mt-12 w-full border-t border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/40">
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
        <!-- Brand + socials -->
        <div class="col-span-2 sm:col-span-1">
          <NuxtLink to="/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2">
            <img src="/assets/logo.png" alt="lota" width="20" height="20" class="h-5 w-5">
            <span class="text-base font-semibold text-gray-900 dark:text-white">lota</span>
          </NuxtLink>
          <p class="mt-2 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {{ t('footer.tagline') || 'Инструменты для управления бизнесом: заказы, посещаемость, задачи, клиенты, склад и запись.' }}
          </p>
          <div class="mt-3 flex items-center gap-1">
            <UButton
              v-for="s in socials"
              :key="s.label"
              :to="s.href"
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              color="gray"
              size="xs"
              square
              :aria-label="s.label"
            >
              <UIcon :name="s.icon" class="h-3.5 w-3.5" />
            </UButton>
          </div>
        </div>

        <!-- Products -->
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('footer.products') || 'Продукты' }}
          </h3>
          <ul class="mt-3 space-y-2">
            <li v-for="p in products" :key="p.to">
              <NuxtLink
                :to="p.to"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {{ p.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('footer.resources') || 'Ресурсы' }}
          </h3>
          <ul class="mt-3 space-y-2">
            <li v-for="r in resources" :key="r.to">
              <NuxtLink
                :to="r.to"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {{ r.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div class="col-span-2 sm:col-span-1">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('legal.docsTitle') || 'Правовые документы' }}
          </h3>
          <ul class="mt-3 space-y-2">
            <li v-for="l in legal" :key="l.to">
              <NuxtLink
                :to="l.to"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {{ l.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800 sm:flex-row sm:justify-between">
        <span class="text-xs text-gray-400 dark:text-gray-500">© {{ year }} lota — @pieceowater</span>
        <a
          href="mailto:pieceowater@gmail.com"
          class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          pieceowater@gmail.com
        </a>
      </div>
    </div>
  </footer>
</template>
