<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit, unique name -- see pages/atrace.vue for why this matters (a
// duplicate route name corrupts Vue Router's matcher for both routes).
definePageMeta({ name: 'landing-goods' });

const { t } = useI18n();

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const pageTitle = 'lota Goods — касса и складской учёт';
const pageDescription = 'Продажи на кассе, приход и списание, инвентаризация, поставщики и отчёты по остаткам — lota Goods для розницы и общепита.';

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/goods`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/goods` }],
});

const features = [
  { icon: 'lucide:scan-barcode', title: t('landing.goods.f1Title') || 'Касса и продажи', description: t('landing.goods.f1Desc') || 'Пробивайте продажи по позициям — остатки и выручка считаются сами.' },
  { icon: 'lucide:package', title: t('landing.goods.f2Title') || 'Складской учёт', description: t('landing.goods.f2Desc') || 'Приход, списание и перемещение между складами — вся история по каждой позиции.' },
  { icon: 'lucide:clipboard-list', title: t('landing.goods.f3Title') || 'Инвентаризация', description: t('landing.goods.f3Desc') || 'Пересчитайте склад и зафиксируйте излишки и недостачи в пару касаний.' },
  { icon: 'lucide:truck', title: t('landing.goods.f4Title') || 'Поставщики и закупки', description: t('landing.goods.f4Desc') || 'Ведите поставщиков и оформляйте приход по накладной.' },
  { icon: 'lucide:book-open', title: t('landing.goods.f5Title') || 'Прайс-листы и рецептуры', description: t('landing.goods.f5Desc') || 'Несколько прайс-листов и составные позиции из ингредиентов.' },
  { icon: 'lucide:utensils', title: t('landing.goods.f6Title') || 'Связка с lota Orders', description: t('landing.goods.f6Desc') || 'Продажа блюда в Orders сама списывает ингредиенты со склада.' },
];

const steps = [
  { title: t('landing.goods.s1Title') || 'Заведите номенклатуру', description: t('landing.goods.s1Desc') || 'Товары, единицы измерения и цены — списком или по одному.' },
  { title: t('landing.goods.s2Title') || 'Оприходуйте остатки', description: t('landing.goods.s2Desc') || 'Внесите текущий склад приходом или инвентаризацией.' },
  { title: t('landing.goods.s3Title') || 'Продавайте и считайте', description: t('landing.goods.s3Desc') || 'Остатки, себестоимость и выручка обновляются в реальном времени.' },
];

const whoFor = [
  t('landing.goods.who1') || 'Розница',
  t('landing.goods.who2') || 'Магазины у дома',
  t('landing.goods.who3') || 'Кафе и бары',
  t('landing.goods.who4') || 'Склады',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.goods"
    app-address="goods"
    :eyebrow="t('landing.goods.eyebrow') || 'Касса и склад'"
    name="lota Goods"
    :headline="t('landing.goods.headline') || 'Касса и склад, которые считают сами'"
    :subheadline="t('landing.goods.subheadline') || 'Продажи, приход и списание, инвентаризация и отчёты по остаткам — без тетрадок и ручного пересчёта в конце смены.'"
    hero-icon="lucide:package"
    accent-from="from-amber-500"
    accent-to="to-orange-600"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
