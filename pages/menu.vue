<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit, unique name -- see pages/atrace.vue for why this matters (a
// duplicate route name corrupts Vue Router's matcher for both routes).
definePageMeta({ name: 'landing-menu' });

const { t } = useI18n();

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');
const pageTitle = 'lota Orders — онлайн-меню и приём заказов по QR';
const pageDescription = 'Меню, заказы и кухонный дисплей в реальном времени — lota Orders для кафе, ресторанов и доставки.';

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/menu`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/menu` }],
});

const features = [
  { icon: 'lucide:qr-code', title: t('landing.menu.f1Title') || 'Меню по QR', description: t('landing.menu.f1Desc') || 'Гость сканирует код за столом и заказывает сам — без бумажного меню и официанта с блокнотом.' },
  { icon: 'lucide:bell-ring', title: t('landing.menu.f2Title') || 'Заказы в реальном времени', description: t('landing.menu.f2Desc') || 'Новый заказ появляется мгновенно, без обновления страницы.' },
  { icon: 'lucide:monitor', title: t('landing.menu.f3Title') || 'Кухонный дисплей', description: t('landing.menu.f3Desc') || 'Экран для кухни показывает очередь заказов по стадиям готовки.' },
  { icon: 'lucide:building-2', title: t('landing.menu.f4Title') || 'Несколько филиалов', description: t('landing.menu.f4Desc') || 'Своё меню, персонал и QR-коды на каждую точку сети.' },
  { icon: 'lucide:megaphone', title: t('landing.menu.f5Title') || 'Промо-баннеры и бейджи', description: t('landing.menu.f5Desc') || 'Поднимайте продажи нужных позиций акциями прямо в меню.' },
  { icon: 'lucide:truck', title: t('landing.menu.f6Title') || 'Доставка через Issues', description: t('landing.menu.f6Desc') || 'Готовый заказ сам становится задачей курьеру в lota Issues.' },
];

const steps = [
  { title: t('landing.menu.s1Title') || 'Соберите меню', description: t('landing.menu.s1Desc') || 'Категории, позиции, цены и фото — за один присест.' },
  { title: t('landing.menu.s2Title') || 'Разместите QR-коды', description: t('landing.menu.s2Desc') || 'Распечатайте и расставьте на столах или витрине.' },
  { title: t('landing.menu.s3Title') || 'Принимайте заказы', description: t('landing.menu.s3Desc') || 'Заказы летят на кухню и в статистику сразу же.' },
];

const whoFor = [
  t('landing.menu.who1') || 'Кафе и рестораны',
  t('landing.menu.who2') || 'Доставка еды',
  t('landing.menu.who3') || 'Фудтраки',
  t('landing.menu.who4') || 'Сети с несколькими точками',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.menu"
    app-address="menu"
    :eyebrow="t('landing.menu.eyebrow') || 'Приём заказов'"
    name="lota Orders"
    :headline="t('landing.menu.headline') || 'Заказы, меню и кухня — под контролем'"
    :subheadline="t('landing.menu.subheadline') || 'Онлайн-меню по QR, заказы в реальном времени и кухонный дисплей — всё, чтобы гость не ждал, а кухня не путалась.'"
    hero-icon="lucide:receipt-text"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
