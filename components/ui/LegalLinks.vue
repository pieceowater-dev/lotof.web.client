<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

// Tidy, unobtrusive links to lota's public legal documents. They live in
// lota Гид under the GLOBAL "Правовые документы" category, one stable slug
// each -- /guide/global/<slug>. Backed by the boot-time seeder in
// lotof.capital.msvc.core (internal/pkg/guide/svc/legal_seed.go).
type DocId = 'terms' | 'offer' | 'privacy' | 'personalData' | 'cookies';

const DOC_SLUG: Record<DocId, string> = {
  terms: 'terms',
  offer: 'offer',
  privacy: 'privacy',
  personalData: 'personal-data',
  cookies: 'cookies',
};

const DOC_FALLBACK: Record<DocId, string> = {
  terms: 'Пользовательское соглашение',
  offer: 'Публичная оферта',
  privacy: 'Политика конфиденциальности',
  personalData: 'Обработка персональных данных',
  cookies: 'Файлы cookie',
};

const CONTEXT_DOCS: Record<'footer' | 'login' | 'payment', DocId[]> = {
  footer: ['terms', 'offer', 'privacy', 'personalData', 'cookies'],
  login: ['terms', 'privacy'],
  payment: ['offer', 'terms', 'privacy'],
};

const props = withDefaults(
  defineProps<{
    /** Picks the sensible doc subset + lead-in sentence. */
    context?: 'footer' | 'login' | 'payment';
    /** Explicit doc list; overrides `context`'s default subset. */
    docs?: DocId[];
    align?: 'center' | 'start';
    /** Open in a new tab so a login / checkout flow is never interrupted. */
    newTab?: boolean;
  }>(),
  { context: 'footer', docs: () => [], align: 'center', newTab: true },
);

const { t } = useI18n();

const items = computed(() => {
  const ids = props.docs?.length ? props.docs : CONTEXT_DOCS[props.context];
  return ids.map((id) => ({
    slug: DOC_SLUG[id],
    label: t(`legal.${id}`) || DOC_FALLBACK[id],
  }));
});

const lead = computed(() => {
  if (props.context === 'login') return t('legal.agreeLogin') || 'Продолжая, вы соглашаетесь с';
  if (props.context === 'payment') return t('legal.agreePayment') || 'Оформляя подписку, вы принимаете';
  return '';
});
</script>

<template>
  <div
    class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed text-gray-400 dark:text-gray-500"
    :class="align === 'center' ? 'justify-center text-center' : 'justify-start'"
  >
    <span v-if="lead">{{ lead }}</span>
    <template
      v-for="(item, i) in items"
      :key="item.slug"
    >
      <span
        v-if="i > 0"
        aria-hidden="true"
        class="opacity-60"
      >·</span>
      <NuxtLink
        :to="`/guide/global/${item.slug}`"
        :target="newTab ? '_blank' : undefined"
        :rel="newTab ? 'noopener noreferrer' : undefined"
        class="underline-offset-2 transition-colors hover:text-gray-600 hover:underline dark:hover:text-gray-300"
      >
        {{ item.label }}
      </NuxtLink>
    </template>
  </div>
</template>
