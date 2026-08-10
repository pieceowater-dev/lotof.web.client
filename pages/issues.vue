<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit, unique name -- see pages/atrace.vue for why this matters (a
// duplicate route name corrupts Vue Router's matcher for both routes).
definePageMeta({ name: 'landing-issues' });

const { t } = useI18n();

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');
const pageTitle = 'lota Issues — таск-трекер для команд в поле и в офисе';
const pageDescription = 'Канбан-доски, спринты, SLA и живая карта курьеров — lota Issues держит задачи под контролем от постановки до закрытия.';

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/issues`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/issues` }],
});

const features = [
  { icon: 'lucide:columns-3', title: t('landing.issues.f1Title') || 'Канбан-доски', description: t('landing.issues.f1Desc') || 'Свои статусы и цвета колонок под процесс любой команды — без навязанных шаблонов.' },
  { icon: 'lucide:trending-down', title: t('landing.issues.f2Title') || 'Спринты и сгорание', description: t('landing.issues.f2Desc') || 'Группируйте задачи в спринты и следите за темпом на графике сгорания.' },
  { icon: 'lucide:timer', title: t('landing.issues.f3Title') || 'SLA и эскалации', description: t('landing.issues.f3Desc') || 'Таймер на тип задачи — если просрочено, ответственный узнаёт первым.' },
  { icon: 'lucide:map-pin', title: t('landing.issues.f4Title') || 'Карта и Zen Mode', description: t('landing.issues.f4Desc') || 'Выездные сотрудники видят маршрут в телефоне, а диспетчер — всех на карте.' },
  { icon: 'lucide:zap', title: t('landing.issues.f5Title') || 'Автоматизации с Menu', description: t('landing.issues.f5Desc') || 'Заказ из lota Orders сам становится задачей, а статус долетает обратно.' },
  { icon: 'lucide:link', title: t('landing.issues.f6Title') || 'Публичный трекинг', description: t('landing.issues.f6Desc') || 'Клиент следит за статусом своей заявки по ссылке — без звонков "ну как там".' },
];

const steps = [
  { title: t('landing.issues.s1Title') || 'Создайте доску', description: t('landing.issues.s1Desc') || 'Под отдел, проект или тип работы — досок можно завести сколько нужно.' },
  { title: t('landing.issues.s2Title') || 'Настройте статусы и типы', description: t('landing.issues.s2Desc') || 'Опишите свой процесс: колонки, типы задач, SLA — под вашу команду.' },
  { title: t('landing.issues.s3Title') || 'Работайте', description: t('landing.issues.s3Desc') || 'С канбана в браузере или из Zen Mode на телефоне у выездных сотрудников.' },
];

const whoFor = [
  t('landing.issues.who1') || 'Служба доставки',
  t('landing.issues.who2') || 'Выездной сервис и ремонт',
  t('landing.issues.who3') || 'IT-поддержка',
  t('landing.issues.who4') || 'Небольшие команды',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.issues"
    app-address="issues"
    :eyebrow="t('landing.issues.eyebrow') || 'Таск-трекер'"
    name="lota Issues"
    :headline="t('landing.issues.headline') || 'Задачи, которые не теряются между чатами'"
    :subheadline="t('landing.issues.subheadline') || 'Канбан-доски, выездные бригады на карте и SLA — в одном месте для команды, которая работает и в офисе, и в поле.'"
    hero-icon="lucide:clipboard-check"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
