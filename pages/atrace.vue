<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

const { t } = useI18n();

useHead({
  title: 'lota A-Trace — учёт рабочего времени по QR',
  meta: [
    { name: 'description', content: 'QR-отметки на входе, графики смен и расчёт зарплаты по факту отработанного — lota A-Trace вместо бумажных табелей.' },
  ],
});

const features = [
  { icon: 'lucide:qr-code', title: t('landing.atrace.f1Title') || 'QR-отметки', description: t('landing.atrace.f1Desc') || 'Сотрудник сканирует код на точке — приход и уход фиксируются сами.' },
  { icon: 'lucide:calendar-days', title: t('landing.atrace.f2Title') || 'Графики смен', description: t('landing.atrace.f2Desc') || 'Составляйте расписание и сразу видно, кто должен быть на месте.' },
  { icon: 'lucide:wallet', title: t('landing.atrace.f3Title') || 'Зарплата по факту', description: t('landing.atrace.f3Desc') || 'Начисления считаются по реально отработанным часам, а не на глаз.' },
  { icon: 'lucide:repeat', title: t('landing.atrace.f4Title') || 'Подмена смен', description: t('landing.atrace.f4Desc') || 'Сотрудник сам находит замену, а вы просто подтверждаете.' },
  { icon: 'lucide:alarm-clock', title: t('landing.atrace.f5Title') || 'Пороги опозданий', description: t('landing.atrace.f5Desc') || 'Настройте, с какой минуты опоздание считается нарушением.' },
  { icon: 'lucide:megaphone', title: t('landing.atrace.f6Title') || 'Публикации для команды', description: t('landing.atrace.f6Desc') || 'Объявления и новости для смены — в том же приложении, что и учёт.' },
];

const steps = [
  { title: t('landing.atrace.s1Title') || 'Добавьте сотрудников', description: t('landing.atrace.s1Desc') || 'Пригласите команду — им останется только сканировать QR.' },
  { title: t('landing.atrace.s2Title') || 'Разместите QR на точке', description: t('landing.atrace.s2Desc') || 'Один код на вход — печатается за минуту.' },
  { title: t('landing.atrace.s3Title') || 'Смотрите отчёты', description: t('landing.atrace.s3Desc') || 'Часы, опоздания и зарплата считаются автоматически.' },
];

const whoFor = [
  t('landing.atrace.who1') || 'Розница',
  t('landing.atrace.who2') || 'Общепит',
  t('landing.atrace.who3') || 'Склады',
  t('landing.atrace.who4') || 'Сменный персонал',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.atrace"
    app-address="atrace"
    :eyebrow="t('landing.atrace.eyebrow') || 'Учёт рабочего времени'"
    name="lota A-Trace"
    :headline="t('landing.atrace.headline') || 'Кто на смене — видно сразу, без табелей на бумаге'"
    :subheadline="t('landing.atrace.subheadline') || 'QR-отметки, графики смен и расчёт зарплаты по факту отработанного — без экселя и напоминаний в чате.'"
    hero-icon="lucide:qr-code"
    accent-from="from-violet-600"
    accent-to="to-blue-600"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
