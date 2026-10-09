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
  { to: '/plans', label: 'lota Запись' },
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
  <footer v-if="variant === 'minimal'" class="ft-min">
    <div class="mx-auto flex max-w-7xl flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
      <span class="text-xs text-gray-400 dark:text-gray-500">© {{ year }} lota — @pieceowater</span>
      <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <NuxtLink
          v-for="l in legalShort"
          :key="l.to"
          :to="l.to"
          target="_blank"
          rel="noopener noreferrer"
          class="ft-chip"
        >
          {{ l.label }}
        </NuxtLink>
      </div>
    </div>
  </footer>

  <!-- Full: marketing / content footer — a rounded sheet that sits flush with the bottom edge. -->
  <footer v-else class="ft">
    <div class="mx-auto max-w-7xl px-5 pb-6 pt-9 sm:px-8 sm:pt-12">
      <div class="grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <!-- Brand + socials -->
        <div class="col-span-2 lg:col-span-1">
          <NuxtLink to="/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2.5">
            <img src="/assets/logo.png" alt="lota" width="24" height="24" class="h-6 w-6">
            <span class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">lota</span>
          </NuxtLink>
          <p class="mt-3 max-w-xs text-sm leading-6 text-gray-500 dark:text-gray-400">
            {{ t('footer.tagline') || 'Инструменты для управления бизнесом: заказы, посещаемость, задачи, клиенты, склад и запись.' }}
          </p>
          <div class="mt-4 flex items-center gap-2">
            <a
              v-for="s in socials"
              :key="s.label"
              :href="s.href"
              target="_blank"
              rel="noopener noreferrer"
              class="hdr-icon-btn"
              :aria-label="s.label"
            >
              <UIcon :name="s.icon" class="h-4 w-4" />
            </a>
          </div>
        </div>

        <!-- Products -->
        <div>
          <h3 class="sf-label mb-2.5">{{ t('footer.products') || 'Продукты' }}</h3>
          <ul class="-ml-2.5 space-y-0.5">
            <li v-for="p in products" :key="p.to">
              <NuxtLink :to="p.to" target="_blank" rel="noopener noreferrer" class="ft-link">{{ p.label }}</NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h3 class="sf-label mb-2.5">{{ t('footer.resources') || 'Ресурсы' }}</h3>
          <ul class="-ml-2.5 space-y-0.5">
            <li v-for="r in resources" :key="r.to">
              <NuxtLink :to="r.to" target="_blank" rel="noopener noreferrer" class="ft-link">{{ r.label }}</NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div class="col-span-2 lg:col-span-1">
          <h3 class="sf-label mb-2.5">{{ t('legal.docsTitle') || 'Правовые документы' }}</h3>
          <ul class="-ml-2.5 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-1">
            <li v-for="l in legal" :key="l.to">
              <NuxtLink :to="l.to" target="_blank" rel="noopener noreferrer" class="ft-link">{{ l.label }}</NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="ft-bar">
        <span class="text-xs text-gray-400 dark:text-gray-500">© {{ year }} lota — @pieceowater</span>
        <a href="mailto:pieceowater@gmail.com" class="sec-link !py-1.5 !pl-3 !pr-3 !text-xs">
          <UIcon name="lucide:mail" class="h-3.5 w-3.5" />
          pieceowater@gmail.com
        </a>
      </div>
    </div>
  </footer>
</template>
