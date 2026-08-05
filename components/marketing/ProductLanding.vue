<script lang="ts" setup>
// Shared shell for the public, logged-out product landing pages
// (/atrace, /issues, /contacts, /menu) -- one visual language across all
// four so a visitor bouncing between them (or the console team adding a
// fifth product later) gets consistency for free instead of four bespoke
// one-off designs.
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

export interface LandingFeature {
  icon: string;
  title: string;
  description: string;
}
export interface LandingStep {
  title: string;
  description: string;
}

const props = defineProps<{
  appBundle: string;
  appAddress: string;
  eyebrow: string;
  name: string;
  headline: string;
  subheadline: string;
  accentFrom?: string;
  accentTo?: string;
  heroIcon: string;
  features: LandingFeature[];
  steps: LandingStep[];
  whoFor: string[];
}>();

const accentFrom = computed(() => props.accentFrom || 'from-blue-600');
const accentTo = computed(() => props.accentTo || 'to-emerald-600');

// Reuses the exact same attribution/targeting mechanism as a marketing deep
// link (server/routes/l/[code].get.ts): tag the visitor with which app they
// came for, then land on "/" -- already-logged-in visitors get routed
// straight into the app (or its plans page), logged-out ones go through
// auto-login first (pages/index.vue's auth-needed handling), all with no
// bespoke logic needed here.
function handleGetStarted() {
  const targetAppCookie = useCookie<string | null>('target_app', {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
  });
  targetAppCookie.value = props.appBundle;
  navigateTo('/?auth-needed=true');
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950">
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 -z-10">
        <div class="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-500/20 to-emerald-500/10 blur-3xl" />
      </div>
      <div class="max-w-5xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 mb-6">
          <UIcon :name="heroIcon" class="w-3.5 h-3.5" />
          {{ eyebrow }}
        </div>
        <h1 class="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900 dark:text-white leading-[1.1]">
          {{ headline }}
        </h1>
        <p class="mt-6 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          {{ subheadline }}
        </p>
        <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            :class="['inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-shadow', accentFrom, accentTo]"
            @click="handleGetStarted"
          >
            {{ t('landing.getStarted') || 'Получить' }}
            <UIcon name="lucide:arrow-right" class="w-4 h-4" />
          </button>
          <a href="#features" class="inline-flex items-center gap-1.5 rounded-xl px-7 py-3.5 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            {{ t('landing.seeFeatures') || 'Что внутри' }}
            <UIcon name="lucide:chevron-down" class="w-4 h-4" />
          </a>
        </div>
        <p class="mt-6 text-xs text-gray-400">{{ t('landing.freeTierHint') || 'Бесплатный тариф навсегда — карта не нужна' }}</p>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="max-w-6xl mx-auto px-6 py-16 sm:py-20">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{{ t('landing.featuresTitle') || 'Всё нужное — из коробки' }}</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="f in features"
          :key="f.title"
          class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
        >
          <div :class="['inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br mb-4', accentFrom, accentTo]">
            <UIcon :name="f.icon" class="w-5 h-5 text-white" />
          </div>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-1.5">{{ f.title }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{{ f.description }}</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="bg-gray-50 dark:bg-gray-900/40 border-y border-gray-100 dark:border-gray-800">
      <div class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div class="text-center mb-12">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{{ t('landing.howItWorksTitle') || 'Как это работает' }}</h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div v-for="(s, idx) in steps" :key="s.title" class="relative text-center sm:text-left">
            <div :class="['inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br text-white text-sm font-bold mb-4', accentFrom, accentTo]">
              {{ idx + 1 }}
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white mb-1.5">{{ s.title }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{{ s.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Who it's for -->
    <section class="max-w-4xl mx-auto px-6 py-16 sm:py-20 text-center">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">{{ t('landing.whoForTitle') || 'Для кого' }}</h2>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <span
          v-for="w in whoFor"
          :key="w"
          class="rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-300"
        >
          {{ w }}
        </span>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="max-w-4xl mx-auto px-6 pb-20 sm:pb-28">
      <div :class="['relative overflow-hidden rounded-3xl bg-gradient-to-br px-8 py-14 sm:py-16 text-center', accentFrom, accentTo]">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">{{ t('landing.ctaTitle', { name }) || `Попробуйте ${name} бесплатно` }}</h2>
        <p class="text-white/80 mb-8 max-w-lg mx-auto">{{ t('landing.ctaSubtitle') || 'Заводится за пару минут, бесплатный тариф без ограничения по времени.' }}</p>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-gray-900 shadow-lg hover:shadow-xl transition-shadow"
          @click="handleGetStarted"
        >
          {{ t('landing.getStarted') || 'Получить' }}
          <UIcon name="lucide:arrow-right" class="w-4 h-4" />
        </button>
      </div>
    </section>
  </div>
</template>
