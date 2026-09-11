<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit unique route name -- a duplicate name corrupts Vue Router's
// matcher (see pages/atrace.vue).
definePageMeta({ layout: 'full', name: 'landing-plans' });

const { t } = useI18n();

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const pageTitle = 'lota Plans — онлайн-запись и расписание';
const pageDescription = 'Приватная страница онлайн-записи для вашего бизнеса: клиент выбирает услугу, мастера и свободное время. Внутри — календарь записей, услуги, мастера и расписание.';

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/plans`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/plans` }] });

const features = [
  { icon: 'lucide:link', title: t('landing.plans.f1Title') || 'Страница записи по ссылке', description: t('landing.plans.f1Desc') || 'Одна ссылка в шапку Instagram или Google-профиль — клиент записывается без установки приложения и без аккаунта.' },
  { icon: 'lucide:calendar-days', title: t('landing.plans.f2Title') || 'Календарь записей', description: t('landing.plans.f2Desc') || 'Все записи по дням и мастерам в одном месте — создавайте, переносите и отменяйте в пару касаний.' },
  { icon: 'lucide:users', title: t('landing.plans.f3Title') || 'Мастера и услуги', description: t('landing.plans.f3Desc') || 'Каталог услуг с длительностью и ценой, карточки мастеров и их индивидуальное расписание.' },
  { icon: 'lucide:clock', title: t('landing.plans.f4Title') || 'Свободные окна сами', description: t('landing.plans.f4Desc') || 'Доступное время считается из часов работы, расписания мастера и уже занятых записей — без накладок.' },
  { icon: 'lucide:shield-check', title: t('landing.plans.f5Title') || 'Без двойных записей', description: t('landing.plans.f5Desc') || 'Одно и то же окно нельзя занять дважды — гарантия на уровне базы данных.' },
  { icon: 'lucide:bell', title: t('landing.plans.f6Title') || 'Подтверждение и перенос', description: t('landing.plans.f6Desc') || 'Клиент видит подтверждение сразу, а отменить или перенести может по ссылке до назначенного окна.' },
];

const steps = [
  { title: t('landing.plans.s1Title') || 'Заведите точку и услуги', description: t('landing.plans.s1Desc') || 'Адрес, часы работы и список услуг с длительностью и ценой.' },
  { title: t('landing.plans.s2Title') || 'Добавьте мастеров', description: t('landing.plans.s2Desc') || 'Кто какие услуги оказывает и в какие часы работает.' },
  { title: t('landing.plans.s3Title') || 'Поделитесь ссылкой', description: t('landing.plans.s3Desc') || 'Вставьте ссылку записи в профиль — брони начнут падать в календарь.' },
];

const whoFor = [
  t('landing.plans.who1') || 'Барбершопы и салоны',
  t('landing.plans.who2') || 'Мастера маникюра и массажа',
  t('landing.plans.who3') || 'Медицинские кабинеты',
  t('landing.plans.who4') || 'Тренеры и репетиторы',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.plans"
    app-address="plans"
    :eyebrow="t('landing.plans.eyebrow') || 'Онлайн-запись'"
    name="lota Plans"
    :headline="t('landing.plans.headline') || 'Запись на услуги — без переписок и накладок'"
    :subheadline="t('landing.plans.subheadline') || 'Приватная страница записи для вашего бизнеса и календарь броней внутри. Клиент выбирает услугу, мастера и свободное время сам.'"
    hero-icon="lucide:calendar-check"
    accent-from="from-violet-500"
    accent-to="to-fuchsia-600"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
