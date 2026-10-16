<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit, unique name -- see pages/atrace.vue for why this matters (a
// duplicate route name corrupts Vue Router's matcher for both routes).
// The product's route inside a namespace is /{ns}/pages; this public landing lives at /sites so it can
// never collide with a namespace called "pages".
definePageMeta({ layout: 'full', name: 'landing-pages' });

const { t } = useI18n();

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const pageTitle = computed(() => t('seo.pages.title'));
const pageDescription = computed(() => t('seo.pages.description'));

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/sites`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/sites` }],
});

const features = computed(() => [
  { icon: 'lucide:layout-template', title: t('landing.pages.f1Title'), description: t('landing.pages.f1Desc') },
  { icon: 'lucide:sparkles', title: t('landing.pages.f2Title'), description: t('landing.pages.f2Desc') },
  { icon: 'lucide:palette', title: t('landing.pages.f3Title'), description: t('landing.pages.f3Desc') },
  { icon: 'lucide:search-check', title: t('landing.pages.f4Title'), description: t('landing.pages.f4Desc') },
  { icon: 'lucide:languages', title: t('landing.pages.f5Title'), description: t('landing.pages.f5Desc') },
  { icon: 'lucide:globe', title: t('landing.pages.f6Title'), description: t('landing.pages.f6Desc') },
]);
const steps = computed(() => [
  { title: t('landing.pages.s1Title'), description: t('landing.pages.s1Desc') },
  { title: t('landing.pages.s2Title'), description: t('landing.pages.s2Desc') },
  { title: t('landing.pages.s3Title'), description: t('landing.pages.s3Desc') },
]);
const whoFor = computed(() => [
  t('landing.pages.who1'),
  t('landing.pages.who2'),
  t('landing.pages.who3'),
  t('landing.pages.who4'),
]);
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.pages"
    app-address="pages"
    :eyebrow="t('landing.pages.eyebrow')"
    name="lota Сайты"
    :headline="t('landing.pages.headline')"
    :subheadline="t('landing.pages.subheadline')"
    hero-icon="lucide:panels-top-left"
    accent-from="from-sky-500"
    accent-to="to-emerald-500"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
