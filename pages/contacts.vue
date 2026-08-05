<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ProductLanding from '@/components/marketing/ProductLanding.vue';

// Explicit, unique name -- see pages/atrace.vue for why this matters (a
// duplicate route name corrupts Vue Router's matcher for both routes).
definePageMeta({ name: 'landing-contacts' });

const { t } = useI18n();

useHead({
  title: 'lota Contacts — CRM для клиентской базы',
  meta: [
    { name: 'description', content: 'Единая карточка клиента, программы лояльности и история обращений — lota Contacts вместо разрозненных таблиц и блокнотов.' },
  ],
});

const features = [
  { icon: 'lucide:contact', title: t('landing.contacts.f1Title') || 'Единая карточка клиента', description: t('landing.contacts.f1Desc') || 'Имя, телефон, история и заметки — в одном месте, доступном всей команде.' },
  { icon: 'lucide:gift', title: t('landing.contacts.f2Title') || 'Программы лояльности', description: t('landing.contacts.f2Desc') || 'Бонусы и скидки постоянным клиентам без отдельного сервиса.' },
  { icon: 'lucide:list-plus', title: t('landing.contacts.f3Title') || 'Кастомные поля', description: t('landing.contacts.f3Desc') || 'Добавьте поля под свою специфику — от даты рождения до номера договора.' },
  { icon: 'lucide:history', title: t('landing.contacts.f4Title') || 'История обращений', description: t('landing.contacts.f4Desc') || 'Видно, что и когда обсуждали с клиентом в прошлый раз.' },
  { icon: 'lucide:upload', title: t('landing.contacts.f5Title') || 'Импорт из таблиц', description: t('landing.contacts.f5Desc') || 'Перенесите базу из Excel или Google Таблиц за пару минут.' },
  { icon: 'lucide:puzzle', title: t('landing.contacts.f6Title') || 'Связь с Orders и Issues', description: t('landing.contacts.f6Desc') || 'Одна карточка клиента — и в заказах, и в задачах.' },
];

const steps = [
  { title: t('landing.contacts.s1Title') || 'Импортируйте базу', description: t('landing.contacts.s1Desc') || 'Из таблицы или заведите клиентов вручную.' },
  { title: t('landing.contacts.s2Title') || 'Настройте поля', description: t('landing.contacts.s2Desc') || 'Опишите, что важно фиксировать именно у вас.' },
  { title: t('landing.contacts.s3Title') || 'Ведите клиентов', description: t('landing.contacts.s3Desc') || 'Вся история — в одной карточке, а не в трёх чатах.' },
];

const whoFor = [
  t('landing.contacts.who1') || 'Малый бизнес',
  t('landing.contacts.who2') || 'Сфера услуг',
  t('landing.contacts.who3') || 'Салоны и клиники',
  t('landing.contacts.who4') || 'Отделы продаж',
];
</script>

<template>
  <ProductLanding
    app-bundle="pieceowater.contacts"
    app-address="contacts"
    :eyebrow="t('landing.contacts.eyebrow') || 'CRM для клиентов'"
    name="lota Contacts"
    :headline="t('landing.contacts.headline') || 'Каждый клиент под рукой, а не в блокноте'"
    :subheadline="t('landing.contacts.subheadline') || 'Карточка клиента, история обращений и программы лояльности — вместо разрозненных таблиц и переписок.'"
    hero-icon="lucide:briefcase"
    :features="features"
    :steps="steps"
    :who-for="whoFor"
  />
</template>
