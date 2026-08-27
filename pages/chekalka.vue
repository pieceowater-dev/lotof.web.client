<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useAnalytics } from '@/composables/useAnalytics';

// Dedicated route for chekalka.kz-driven traffic (see the marketer brief
// this page implements: /Users/pieceowater/Downloads/promt-lending-chekalka.md).
// Deliberately separate from /atrace, which is the general-purpose "lota
// A-Trace" product page for every other traffic source (in-app nav, guide
// links, other deep links) -- keeping them apart means this page's noindex +
// no-nav + KZ-tenge-pricing + Чекалка-only branding never leaks onto traffic
// that didn't come from chekalka.kz, and /atrace never regresses back to
// this funnel's stripped-down, single-purpose layout.
//
// layout: false -- see the brief section 5, item 5: a visitor who clicked
// "Начать бесплатно" on chekalka.kz must not land on a page with the app's
// unrelated 7-link product-suite nav bar.
definePageMeta({ name: 'landing-chekalka', layout: false });

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const siteHost = resolveSiteHost(config.public.siteUrl);

const pageTitle = 'Чекалка — учёт рабочего времени по QR. Начать бесплатно';
const pageDescription = 'Учёт рабочего времени по QR-коду для бизнеса в Казахстане. Цена за всю компанию, до 5 сотрудников бесплатно. Вход через Google, карта не нужна.';

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: 'Чекалка — учёт рабочего времени по QR',
  ogDescription: 'Кто на смене, видно сразу. Бесплатно до 5 сотрудников, карта не нужна.',
  ogType: 'website',
  ogUrl: `${siteUrl}/chekalka`,
  // TODO(marketing): no branded 1200x630 Чекалка OG image exists yet -- this
  // falls back to the shared site image, which is exactly the "wrong brand
  // in the WhatsApp preview" problem this page is meant to fix. Flagged in
  // the implementation report as a blocking open item.
  ogImage: `${siteUrl}/og-image.png`,
  ogImageAlt: 'Чекалка — учёт рабочего времени по QR-коду',
  ogLocale: 'ru_RU',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Чекалка — учёт рабочего времени по QR',
  twitterDescription: 'Кто на смене, видно сразу. Бесплатно до 5 сотрудников, карта не нужна.',
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/chekalka` }],
  // noindex: chekalka.kz (78 statей, растущий трафик) is this product's real
  // SEO asset. An indexable page on a second domain about the same topic
  // competes with it in search results and dilutes the brand -- this page
  // exists purely to convert traffic chekalka.kz already sent, not to rank.
  // "follow" is kept so the footer link back to chekalka.kz still passes
  // through normally.
  meta: [{ name: 'robots', content: 'noindex, follow' }],
  // Escape the global "%s | lota" titleTemplate (nuxt.config.ts) -- this
  // page's tab title must read "Чекалка", not "...| lota": the visitor
  // clicked a Чекалка-branded button and any second brand name in the tab
  // reads as "wrong site". Same pattern pages/index.vue already uses.
  titleTemplate: (s) => s ?? pageTitle,
});

const { isLoggedIn, login } = useAuth();

// Sends the visitor straight to Google's consent screen with no
// intermediate screen -- the brief's number one conversion fix: today's
// chain is deep-link -> this landing page -> home page -> Google, three
// hops after the click. useAuth's login() already builds the correct
// Google auth URL (carrying target_app/lead/referral cookies) and redirects
// via window.location.href itself, so calling it directly from here removes
// the middle "bounce through /" hop entirely for the common case (a visitor
// who isn't already logged in). An already-logged-in visitor (rare for this
// specific traffic source) still goes through "/?auth-needed=true", since
// that path already correctly resolves an existing session into the app
// instead of re-prompting Google sign-in.
function handleGetStarted(location: 'hero' | 'final') {
  const targetAppCookie = useCookie<string | null>('target_app', {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
  });
  targetAppCookie.value = 'pieceowater.atrace';

  useAnalytics().track('chekalka_cta_click', { location });

  if (isLoggedIn.value) {
    navigateTo('/?auth-needed=true');
    return;
  }
  login();
}

function trackWhatsAppClick(location: 'header' | 'final') {
  useAnalytics().track('chekalka_whatsapp_click', { location });
}

// Header CTA is hidden until the visitor scrolls past the hero -- the hero
// already carries the primary button, a second one pinned in the header
// from the first pixel is just visual noise on a page this short.
//
// This page is its own scroll container (see the root <div>'s
// h-screen/overflow-y-auto, required because layout:false opts out of the
// app's usual ".main-scroll" element) -- so the scroll event fires on that
// div, not on `window`, and progress is read from its scrollTop.
const isScrolled = ref(false);
const scrollRoot = ref<HTMLElement | null>(null);
function onScroll() {
  isScrolled.value = (scrollRoot.value?.scrollTop ?? 0) > 480;
}

// Instagram/WhatsApp/Facebook's built-in browsers commonly block Google's
// OAuth consent screen outright (Google refuses to render it inside a
// generic embedded webview) -- both marketer briefs for this page call this
// out explicitly. Detecting it up front and telling the visitor to open in
// their real browser beats letting them tap "Начать бесплатно" and hit a
// dead end with no explanation.
const isInAppBrowser = ref(false);

onMounted(() => {
  scrollRoot.value?.addEventListener('scroll', onScroll, { passive: true });
  const ua = navigator.userAgent || '';
  isInAppBrowser.value = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\//i.test(ua);
});
onBeforeUnmount(() => {
  scrollRoot.value?.removeEventListener('scroll', onScroll);
});

const WHATSAPP_URL = 'https://wa.me/77089621804';

const steps = [
  { time: 'Меньше минуты', title: 'Вход через Google', desc: 'Пароль не создаётся.' },
  { time: 'Минута', title: 'Указываете сферу бизнеса', desc: 'Система сама создаёт готовые графики под общепит, розницу, услуги или логистику.' },
  { time: 'Пара минут', title: 'Создаёте точку', desc: 'Название, адрес, координаты.' },
  { time: '', title: 'Выводите QR на экран или печатаете', desc: 'Сотрудник наводит камеру, отметка проходит.' },
];

// Verbatim per tz-lending-atrace.md section 7 (all 7 bullets, including the
// routes one that a prior editorial pass dropped as "6 of 7 strongest" --
// the newer spec asks for the full list).
const outcomes = [
  'Видно поимённо, кто опаздывает и на сколько. Споров «я приходил вовремя» больше нет.',
  'Табель собирается сам и выгружается в Excel двумя листами.',
  'Зарплата считается по факту: база, переработка, штрафы, итог. Видно, из чего сложилась сумма.',
  'Подмены смен и отгулы согласуются в системе и сразу попадают в расчёт, а не теряются в переписке.',
  'Опоздал, но отработал это время в тот же день — нарушение не засчитывается. Настраивается.',
  'Менеджер управляет графиками и согласует заявки, но не видит зарплату, даже свою.',
  'Для выездных: маршрут из контрольных точек, видно, все ли пройдены и в каком порядке.',
];

// "Всё нужное — из коробки" -- per tz-lending-atrace.md section 6: keep 5 of
// the original ProductLanding feature cards, rewrite the QR one (dynamic
// QR is the real primary method, not the static printed code the old copy
// led with), drop "Публикации для команды" (confirmed not a real feature),
// add "Отчёты и выгрузка". The TZ's rewritten QR copy also mentions a PIN
// phrase as a no-screen fallback -- deliberately omitted here per explicit
// instruction earlier in this session to never mention PIN on this page.
const features = [
  { icon: 'lucide:qr-code', title: 'QR-отметки', desc: 'Код на экране точки меняется каждые 5 секунд. Сфотографировать и переслать в чат бесполезно. Для точек без экрана — печатный код.' },
  { icon: 'lucide:calendar-days', title: 'Графики смен', desc: 'Составляйте расписание и сразу видно, кто должен быть на месте.' },
  { icon: 'lucide:wallet', title: 'Зарплата по факту', desc: 'Начисления считаются по реально отработанным часам, а не на глаз.' },
  { icon: 'lucide:repeat', title: 'Подмена смен', desc: 'Сотрудник сам находит замену, а вы просто подтверждаете.' },
  { icon: 'lucide:alarm-clock', title: 'Пороги опозданий', desc: 'Настройте, с какой минуты опоздание считается нарушением.' },
  { icon: 'lucide:file-spreadsheet', title: 'Отчёты и выгрузка', desc: 'Excel двумя листами: сводка по команде и подённая раскладка по каждому сотруднику.' },
];

const pricingTiers = [
  { size: 'До 5 сотрудников', price: 'Бесплатно', note: 'полный функционал, без ограничения по сроку', highlight: false },
  { size: '6–30 сотрудников', price: '3 000 ₸/мес', note: 'за всю компанию', highlight: true },
  { size: '31–100 сотрудников', price: '6 500 ₸/мес', note: 'за всю компанию', highlight: false },
  { size: '100+ сотрудников', price: 'Индивидуально', note: '', highlight: false },
];

const whoFor = [
  { industry: 'Кофейни и рестораны', detail: 'смены «2 через 2», ночные, подмены между официантами' },
  { industry: 'Розница', detail: 'несколько точек в одном кабинете, видно каждую отдельно' },
  { industry: 'Салоны и барбершопы', detail: 'плавающие графики мастеров' },
  { industry: 'Склады и логистика', detail: 'пересменки и переработки' },
  { industry: 'Стройка и подряд', detail: 'бригады на объектах, контрольные точки' },
  { industry: 'Выездные команды', detail: 'отметка по факту прибытия на адрес' },
];

const faqItems = [
  {
    label: 'Это правда бесплатно?',
    content: 'До 5 сотрудников — да, полный функционал, без ограничения по сроку и без карты. Дальше 3 000 ₸ в месяц за всю компанию до 30 человек.',
  },
  {
    label: 'Что будет, когда сотрудников станет шесть?',
    content: 'Система предложит перейти на тариф выше, а не оборвёт работу ошибкой. Данные остаются на месте.',
  },
  {
    label: 'Сотрудникам надо что-то устанавливать?',
    content: 'Нет. Отметка идёт через камеру телефона, открывается обычная страница в браузере. Приложение ставить не нужно. Что понадобится — смартфон с камерой, интернет в момент отметки и личный Google-аккаунт у каждого.',
  },
  {
    label: 'А если они будут отмечаться друг за друга?',
    content: 'Код на экране точки меняется каждые 5 секунд. Координаты телефона сверяются с координатами точки, радиус настраивается. Система запоминает, с какого телефона обычно отмечается человек, и сама помечает подозрительное: если один телефон за сутки отметил разных людей или если сотрудник за неделю отмечался больше чем с трёх устройств. Честно: обмануть тут не невозможно — просто обойти всё это дороже и муторнее, чем отметиться самому.',
  },
  {
    label: 'Законно ли собирать геолокацию сотрудников в Казахстане?',
    content: 'Геолокация и параметры устройства относятся к персональным данным, работодателю нужно письменное согласие работника. Разбор закона и образец согласия — по ссылкам ниже.',
    links: [
      { text: 'Законность геолокации', href: 'https://chekalka.kz/geolokaciya-sotrudnikov-zakon-rk/' },
      { text: 'Образец согласия', href: 'https://chekalka.kz/soglasie-na-geolokatsiyu-rabotnika/' },
    ],
  },
  {
    label: 'Где хранятся данные?',
    content: 'Данные каждой компании хранятся в отдельной базе, а не общей кучей с пометкой. Права проверяются на сервере при каждом запросе. К аккаунту привязывается не больше трёх устройств, любое можно отключить самому. Паролей в системе нет вообще.',
  },
  {
    label: 'Почему в адресной строке lota, а не Чекалка?',
    content: `Чекалка — продукт компании Lota Business. Личный кабинет работает на нашей платформе ${siteHost}, поэтому название в адресной строке другое. Это то же самое.`,
  },
  {
    label: 'Кто поможет настроить?',
    content: 'Справочный центр на русском, казахском и английском. Плюс WhatsApp: +7 708 962-18-04, с 9:00 до 20:00 по Алматы.',
  },
];
</script>

<template>
  <!-- h-screen + overflow-y-auto: this page uses layout: false (see script),
       so it never gets layouts/default.vue's own scroll container
       (".main-scroll"). assets/css/global.css sets `html, body { overflow:
       hidden }` globally and delegates scrolling to that container -- pages
       that opt out of the default layout have to provide their own, or the
       page is simply unscrollable outside the accidental ".ios" class hook
       (added for a different reason: status-bar tap-to-scroll), which is
       why this scrolled on iOS Safari but not desktop mouse wheel. -->
  <div
    ref="scrollRoot"
    class="h-screen overflow-y-auto bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
  >
    <!-- BLOCK 0: header -->
    <header class="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div class="flex items-center gap-2 font-semibold">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-600 text-white">
            <UIcon
              name="lucide:qr-code"
              class="h-4.5 w-4.5"
            />
          </span>
          <span class="flex flex-col leading-tight">
            <span class="text-lg">Чекалка</span>
            <span class="hidden text-[11px] font-normal text-gray-400 dark:text-gray-500 sm:block">Честный учёт — в один QR-код</span>
          </span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            :to="WHATSAPP_URL"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            color="gray"
            size="sm"
            icon="lucide:message-circle"
            class="hidden sm:inline-flex"
            @click="trackWhatsAppClick('header')"
          >
            WhatsApp
          </UButton>
          <Transition
            enter-active-class="transition-opacity duration-150"
            leave-active-class="transition-opacity duration-150"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <UButton
              v-if="isScrolled"
              color="primary"
              size="sm"
              class="bg-gradient-to-r from-blue-600 to-emerald-600"
              @click="handleGetStarted('hero')"
            >
              Начать бесплатно
            </UButton>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Встроенные браузеры Instagram/WhatsApp обычно блокируют вход через
         Google -- предупреждаем заранее, а не молчим при сбое. -->
    <div
      v-if="isInAppBrowser"
      class="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200"
    >
      Вход через Google может не открыться во встроенном браузере. Откройте эту страницу в обычном браузере телефона — через меню в углу экрана, пункт «Открыть в браузере» или «Ещё».
    </div>

    <!-- BLOCK 1: hero -->
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 -z-10">
        <div class="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-500/15 to-emerald-500/10 blur-3xl" />
      </div>
      <div class="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-10 sm:pt-14 lg:grid-cols-2 lg:gap-12 lg:pb-20">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-gray-600 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-300">
            <UIcon
              name="lucide:qr-code"
              class="h-3.5 w-3.5"
            />
            ЧЕКАЛКА · учёт рабочего времени по QR
          </div>
          <h1 class="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Кто на смене — видно сразу, без бумажных табелей
          </h1>
          <p class="mt-5 max-w-xl text-lg text-gray-500 dark:text-gray-400">
            QR-отметки, графики смен и расчёт зарплаты по факту отработанного. Для бизнеса в Казахстане.
          </p>

          <div class="mt-8">
            <UButton
              size="xl"
              color="primary"
              class="bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3.5 text-base font-semibold shadow-lg shadow-emerald-600/20"
              @click="handleGetStarted('hero')"
            >
              Начать бесплатно
              <template #trailing>
                <UIcon
                  name="lucide:arrow-right"
                  class="h-4 w-4"
                />
              </template>
            </UButton>

            <ul class="mt-4 space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
              <li class="flex items-center gap-2">
                <UIcon
                  name="lucide:check"
                  class="h-4 w-4 flex-shrink-0 text-emerald-500"
                />
                Вход через Google — пароль придумывать не надо
              </li>
              <li class="flex items-center gap-2">
                <UIcon
                  name="lucide:check"
                  class="h-4 w-4 flex-shrink-0 text-emerald-500"
                />
                Карта не нужна
              </li>
              <li class="flex items-center gap-2">
                <UIcon
                  name="lucide:check"
                  class="h-4 w-4 flex-shrink-0 text-emerald-500"
                />
                До 5 сотрудников — бесплатно, без ограничения по сроку
              </li>
            </ul>
          </div>

          <p class="mt-6 text-sm font-medium text-gray-700 dark:text-gray-300">
            Более 240 компаний в Казахстане ведут учёт через Чекалку
          </p>

          <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Кабинет открывается на {{ siteHost }} — это наша платформа. Разработчик: Lota Business, Казахстан.
          </p>
        </div>

        <!-- Product visual: report table mockup. No real product screenshot
             was available for this page -- this is a labeled stand-in built
             to match the actual AttendanceStatsTable UI's structure/colors
             (see components/atrace/AttendanceStatsTable.vue), not a stock
             illustration. Flagged as a blocking open item in the report;
             swap the <div class="report-mock"> block below for a real
             screenshot (webp, explicit width/height) when one exists. -->
        <div class="relative">
          <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
              <span class="text-sm font-semibold">Смена — сегодня</span>
              <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Гео подтверждено</span>
            </div>
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="text-xs text-gray-400 dark:text-gray-500">
                  <th class="px-5 py-2 font-medium">
                    Сотрудник
                  </th>
                  <th class="px-2 py-2 font-medium">
                    Пришёл
                  </th>
                  <th class="px-2 py-2 font-medium">
                    Часы
                  </th>
                  <th class="px-5 py-2 text-right font-medium">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50 dark:divide-gray-800/60">
                <tr>
                  <td class="px-5 py-3 font-medium">
                    Асель К.
                  </td>
                  <td class="px-2 py-3 text-gray-500 dark:text-gray-400">
                    09:58
                  </td>
                  <td class="px-2 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                    8.0
                  </td>
                  <td class="px-5 py-3 text-right">
                    <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Вовремя</span>
                  </td>
                </tr>
                <tr>
                  <td class="px-5 py-3 font-medium">
                    Данияр Т.
                  </td>
                  <td class="px-2 py-3 text-gray-500 dark:text-gray-400">
                    10:14
                  </td>
                  <td class="px-2 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                    7.7
                  </td>
                  <td class="px-5 py-3 text-right">
                    <span class="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Опоздание 14 мин</span>
                  </td>
                </tr>
                <tr>
                  <td class="px-5 py-3 font-medium">
                    Мадина С.
                  </td>
                  <td class="px-2 py-3 text-gray-500 dark:text-gray-400">
                    09:55
                  </td>
                  <td class="px-2 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                    8.1
                  </td>
                  <td class="px-5 py-3 text-right">
                    <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Вовремя</span>
                  </td>
                </tr>
                <tr>
                  <td class="px-5 py-3 font-medium">
                    Ерлан Б.
                  </td>
                  <td class="px-2 py-3 text-gray-400 dark:text-gray-600">
                    —
                  </td>
                  <td class="px-2 py-3 tabular-nums text-gray-400 dark:text-gray-600">
                    0.0
                  </td>
                  <td class="px-5 py-3 text-right">
                    <span class="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">Не отметился</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 2: first five minutes -->
    <section class="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
      <div class="mx-auto max-w-5xl px-5 py-14 sm:py-16">
        <h2 class="text-2xl font-bold sm:text-3xl">
          Что произойдёт в ближайшие пять минут
        </h2>
        <div class="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(s, idx) in steps"
            :key="s.title"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 text-sm font-bold text-white">
              {{ idx + 1 }}
            </div>
            <p
              v-if="s.time"
              class="mt-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
            >
              {{ s.time }}
            </p>
            <h3 class="mt-1 font-semibold">
              {{ s.title }}
            </h3>
            <p class="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {{ s.desc }}
            </p>
          </div>
        </div>

        <div class="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
          Приглашение сотрудников идёт по email, каждому понадобится свой Google-аккаунт. Если в команде есть телефоны без сервисов Google, лучше знать об этом заранее, а не после регистрации.
        </div>
      </div>
    </section>

    <!-- BLOCK 2b: everything included -->
    <section class="mx-auto max-w-6xl px-5 py-14 sm:py-16">
      <h2 class="text-2xl font-bold sm:text-3xl">
        Всё нужное — из коробки
      </h2>
      <div class="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="f in features"
          :key="f.title"
          class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600">
            <UIcon
              :name="f.icon"
              class="h-5 w-5 text-white"
            />
          </div>
          <h3 class="mb-1.5 font-semibold">
            {{ f.title }}
          </h3>
          <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {{ f.desc }}
          </p>
        </div>
      </div>
    </section>

    <!-- BLOCK 3: what changes in a month -->
    <section class="mx-auto max-w-6xl px-5 py-14 sm:py-16">
      <div class="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 class="text-2xl font-bold sm:text-3xl">
            Что изменится через месяц
          </h2>
          <ul class="mt-8 space-y-4">
            <li
              v-for="o in outcomes"
              :key="o"
              class="flex gap-3"
            >
              <UIcon
                name="lucide:check-circle-2"
                class="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500"
              />
              <span class="text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-[15px]">{{ o }}</span>
            </li>
          </ul>
        </div>

        <!-- Second visual: phone check-in screen mockup, same caveat as the
             hero visual -- placeholder built to match the real product's
             visual language, not an actual screenshot. -->
        <div class="mx-auto w-full max-w-[280px]">
          <div class="overflow-hidden rounded-[2rem] border-8 border-gray-900 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div class="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                <UIcon
                  name="lucide:check"
                  class="h-7 w-7 text-emerald-600 dark:text-emerald-400"
                />
              </span>
              <p class="font-semibold">
                Отметка принята
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500">
                Сегодня, 09:58 · точка подтверждена
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 4: pricing -->
    <section
      id="pricing"
      class="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
    >
      <div class="mx-auto max-w-5xl px-5 py-14 sm:py-16">
        <h2 class="text-2xl font-bold sm:text-3xl">
          Тарифы
        </h2>

        <div class="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-200">
          Цена за всю компанию, а не за каждого сотрудника. Штат растёт — счёт не меняется.
        </div>

        <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="tier in pricingTiers"
            :key="tier.size"
            class="rounded-2xl border p-5"
            :class="tier.highlight
              ? 'border-blue-300 bg-white shadow-lg shadow-blue-600/10 ring-2 ring-blue-500 dark:border-blue-700 dark:bg-gray-900'
              : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'"
          >
            <span
              v-if="tier.highlight"
              class="mb-2 inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white"
            >
              Чаще всего выбирают
            </span>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ tier.size }}
            </p>
            <p class="mt-1.5 text-2xl font-bold">
              {{ tier.price }}
            </p>
            <p
              v-if="tier.note"
              class="mt-1 text-xs text-gray-400 dark:text-gray-500"
            >
              {{ tier.note }}
            </p>
          </div>
        </div>

        <p class="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Пробный период даётся один раз, отменить и переоформить подписку ради второго не получится.
        </p>
      </div>
    </section>

    <!-- BLOCK 5: who it's for -->
    <section class="mx-auto max-w-4xl px-5 py-14 sm:py-16">
      <h2 class="text-2xl font-bold sm:text-3xl">
        Кому подходит
      </h2>
      <ul class="mt-8 space-y-3">
        <li
          v-for="w in whoFor"
          :key="w.industry"
          class="flex flex-col gap-0.5 rounded-xl border border-gray-100 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-2 dark:border-gray-800"
        >
          <span class="font-semibold">{{ w.industry }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">— {{ w.detail }}</span>
        </li>
      </ul>
    </section>

    <!-- BLOCK 6: FAQ -->
    <section class="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
      <div class="mx-auto max-w-3xl px-5 py-14 sm:py-16">
        <h2 class="text-2xl font-bold sm:text-3xl">
          Вопросы
        </h2>
        <div class="mt-8">
          <UAccordion :items="faqItems">
            <template #default="{ item, open }">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 border-b border-gray-100 py-4 text-left font-medium dark:border-gray-800"
              >
                {{ item.label }}
                <UIcon
                  name="lucide:chevron-down"
                  class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform"
                  :class="{ 'rotate-180': open }"
                />
              </button>
            </template>
            <template #item="{ item }">
              <div class="pb-5 pt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {{ item.content }}
                <div
                  v-if="item.links"
                  class="mt-2 flex flex-col gap-1"
                >
                  <a
                    v-for="l in item.links"
                    :key="l.href"
                    :href="l.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {{ l.text }}
                  </a>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </div>
    </section>

    <!-- BLOCK 7: final CTA -->
    <section class="mx-auto max-w-4xl px-5 py-16 sm:py-20">
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-emerald-600 px-8 py-14 text-center sm:py-16">
        <h2 class="text-2xl font-bold text-white sm:text-3xl">
          Попробуйте Чекалку бесплатно
        </h2>
        <p class="mt-2 text-white/80">
          До 5 сотрудников — полный функционал, без оплаты и без срока.
        </p>
        <div class="mt-8">
          <UButton
            size="xl"
            color="white"
            class="bg-white px-7 py-3.5 text-base font-semibold text-gray-900 shadow-lg"
            @click="handleGetStarted('final')"
          >
            Начать бесплатно
            <template #trailing>
              <UIcon
                name="lucide:arrow-right"
                class="h-4 w-4"
              />
            </template>
          </UButton>
          <p class="mt-4 text-sm text-white/80">
            Вход через Google — пароль придумывать не надо. Карта не нужна.
          </p>
        </div>
        <div class="mt-8 border-t border-white/20 pt-6">
          <UButton
            :to="WHATSAPP_URL"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            icon="lucide:message-circle"
            class="border border-white/50 bg-transparent text-white hover:bg-white/10"
            @click="trackWhatsAppClick('final')"
          >
            Не хотите разбираться сами — напишите в WhatsApp, поможем настроить
          </UButton>
        </div>
      </div>
    </section>

    <!-- BLOCK 8: footer -->
    <footer class="border-t border-gray-100 dark:border-gray-800">
      <div class="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Lota Business, Казахстан, 2026</p>
        <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a
            href="tel:+77089621804"
            class="hover:text-gray-800 dark:hover:text-gray-200"
          >+7 708 962-18-04</a>
          <a
            href="mailto:chekalkakz@gmail.com"
            class="hover:text-gray-800 dark:hover:text-gray-200"
          >chekalkakz@gmail.com</a>
          <a
            href="https://www.instagram.com/chekalka.kz/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-gray-800 dark:hover:text-gray-200"
          >
            Instagram
          </a>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <!-- TODO(marketing): exact oferta/privacy-policy URLs on chekalka.kz
               weren't provided in the brief -- linking to the root domain
               until the real paths are confirmed (flagged in the report). -->
          <a
            href="https://chekalka.kz/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-gray-700 dark:hover:text-gray-300"
          >Оферта</a>
          <a
            href="https://chekalka.kz/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-gray-700 dark:hover:text-gray-300"
          >Политика конфиденциальности</a>
          <a
            href="https://chekalka.kz/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-gray-700 dark:hover:text-gray-300"
          >Подробнее о Чекалке</a>
        </div>
      </div>
    </footer>
  </div>
</template>
