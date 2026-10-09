<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { resolveSiteUrl } from '@/utils/siteUrl';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { telHref, whatsappHref } from '@/utils/phoneLinks';
import { twoGisSearchHref, osmEmbedSrc } from '@/utils/geo';
import StorefrontTopBar from '@/components/storefront/StorefrontTopBar.vue';
import StorefrontHero from '@/components/storefront/StorefrontHero.vue';
import {
  getMembershipStorefront,
  requestMembership,
  getPatronMemberships,
  type MembershipPlan,
  type ClientMembership,
} from '@/api/contacts/public/membershipStorefront';

definePageMeta({ layout: false });

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);

const { token: patronToken, me: patronMe, fetchMe: fetchPatronMe, login: patronLogin } = usePatronAuth();

const { data, pending: loading, error: fetchError } = await useAsyncData(
  `membership-storefront-${nsSlug.value}`,
  () => getMembershipStorefront(nsSlug.value),
);

const error = computed(() => (fetchError.value ? getErrorMessage(fetchError.value) || 'Не удалось загрузить страницу' : null));
const brand = computed(() => data.value?.brand ?? null);
const plans = computed<MembershipPlan[]>(() => data.value?.plans ?? []);

const primary = computed(() => brand.value?.primaryColor || '#4f46e5');
// CTA buttons on top of the brand colour always use white text, by request.
const onPrimary = '#ffffff';
const brandVars = computed(() => ({ '--brand': primary.value, '--brand-ink': onPrimary }));

const social = computed<Array<{ label: string; url: string }>>(() => {
  const raw = brand.value?.socialLinks?.trim();
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj.filter((x) => x?.url).map((x) => ({ label: String(x.label || x.name || 'link'), url: String(x.url) }));
    return Object.entries(obj).filter(([, v]) => !!v).map(([k, v]) => ({ label: k, url: String(v) }));
  } catch {
    return [];
  }
});

const mapSrc = computed(() => {
  const b = brand.value;
  if (!b || (!b.lat && !b.lng)) return '';
  return osmEmbedSrc(b.lat, b.lng);
});

useSeoMeta({
  title: () => brand.value?.seoTitle || brand.value?.name || 'Абонементы',
  description: () => brand.value?.seoDescription || brand.value?.welcomeMessage || 'Оформите абонемент онлайн',
  ogTitle: () => brand.value?.seoTitle || brand.value?.name || 'Абонементы',
  ogDescription: () => brand.value?.seoDescription || brand.value?.welcomeMessage || '',
  ogType: 'website',
  ogUrl: `${siteUrl}/to/${nsSlug.value}/memberships`,
  ogImage: () => brand.value?.logoUrl || undefined,
});

onMounted(() => {
  if (patronToken.value) {
    fetchPatronMe();
    loadMyMemberships();
  }
});

// ── Request sheet ──────────────────────────────────────────────────────
const sheetOpen = ref(false);
const chosenPlan = ref<MembershipPlan | null>(null);
const reqForm = ref({ name: '', phone: '', note: '' });
const submitting = ref(false);
const submittedOk = ref(false);

function loginHere() {
  patronLogin(typeof window !== 'undefined' ? window.location.href : undefined);
}

function startRequest(plan: MembershipPlan) {
  if (!patronToken.value) {
    loginHere();
    return;
  }
  chosenPlan.value = plan;
  reqForm.value = { name: patronMe.value?.name || '', phone: '', note: '' };
  submittedOk.value = false;
  sheetOpen.value = true;
}

async function submitRequest() {
  if (!chosenPlan.value) return;
  if (!reqForm.value.name.trim() || !reqForm.value.phone.trim()) return;
  submitting.value = true;
  try {
    await requestMembership(nsSlug.value, {
      membershipPlanId: chosenPlan.value.id,
      name: reqForm.value.name.trim(),
      phone: reqForm.value.phone.trim(),
      note: reqForm.value.note.trim() || undefined,
    });
    submittedOk.value = true;
    await loadMyMemberships();
  } catch (e) {
    logError('[membership-storefront] request failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Не удалось отправить заявку', color: 'red' });
  } finally {
    submitting.value = false;
  }
}

// ── My memberships ────────────────────────────────────────────────────
const myMemberships = ref<ClientMembership[]>([]);
const myOpen = ref(false);
async function loadMyMemberships() {
  if (!patronToken.value) return;
  try {
    myMemberships.value = await getPatronMemberships(nsSlug.value);
  } catch (e) {
    logError('[membership-storefront] my memberships failed', e);
  }
}

function money(v: string, cur: string) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-KZ')} ${cur}` : `${v} ${cur}`;
}
function planLine(p: MembershipPlan) {
  const a = p.visitLimit > 0 ? `${p.visitLimit} посещений` : 'Безлимитные посещения';
  const b = p.durationDays > 0 ? `${p.durationDays} дней` : 'Без ограничения по сроку';
  return `${a} · ${b}`;
}
const statusLabel: Record<string, string> = {
  PENDING: 'на рассмотрении', ACTIVE: 'активен', FROZEN: 'заморожен',
  EXPIRED: 'завершён', CANCELLED: 'отменён', REJECTED: 'отклонён',
};
</script>

<template>
  <div class="sf" :style="brandVars">
    <StorefrontTopBar :powered-label="t('menu.poweredBy') || 'Powered by'" />

    <div v-if="loading" class="flex min-h-[70vh] items-center justify-center">
      <UIcon name="lucide:loader-2" class="h-8 w-8 animate-spin" :style="{ color: primary }" />
    </div>
    <div v-else-if="error" class="flex min-h-[70vh] items-center justify-center p-6 text-center">
      <div>
        <UIcon name="lucide:store" class="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p class="text-gray-600 dark:text-gray-300">{{ error }}</p>
      </div>
    </div>

    <div v-else-if="brand">
      <StorefrontHero
        :name="brand.name || 'Абонементы'"
        :description="brand.welcomeMessage"
        :logo-url="brand.logoUrl"
        :logo-alt="brand.name || t('membership.logo') || 'Логотип'"
        fallback-icon="lucide:ticket"
      >
        <template #chips>
          <span v-if="brand.city || brand.address" class="sf-pill">
            <UIcon name="lucide:map-pin" class="h-3.5 w-3.5 flex-shrink-0" />
            <span class="truncate">{{ [brand.address, brand.city].filter(Boolean).join(', ') }}</span>
          </span>
          <a v-if="brand.phone" :href="telHref(brand.phone)" class="sf-pill">
            <UIcon name="lucide:phone" class="h-3.5 w-3.5" /> {{ brand.phone }}
          </a>
          <a v-if="brand.phone" :href="whatsappHref(brand.phone)" target="_blank" class="sf-pill">
            <UIcon name="lucide:message-circle" class="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a v-for="s in social" :key="s.url" :href="s.url" target="_blank" class="sf-pill">
            <UIcon name="lucide:link" class="h-3.5 w-3.5" /> {{ s.label }}
          </a>
          <button v-if="patronToken" type="button" class="sf-pill" @click="myOpen = !myOpen; loadMyMemberships()">
            <UIcon name="lucide:ticket" class="h-3.5 w-3.5" /> Мои абонементы
          </button>
          <button v-else type="button" class="sf-pill" @click="loginHere()">
            <UIcon name="lucide:log-in" class="h-3.5 w-3.5" /> Войти
          </button>
        </template>
      </StorefrontHero>

      <div class="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Transition name="sf-fade">
          <div v-if="myOpen && patronToken" class="sf-card p-5">
            <p class="sf-label mb-3">Мои абонементы</p>
            <p v-if="!myMemberships.length" class="text-sm text-gray-500">У вас пока нет абонементов в этом заведении.</p>
            <div v-for="m in myMemberships" :key="m.id" class="border-b border-gray-100 py-3 last:border-0 dark:border-white/10">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">{{ m.planNameSnapshot }}</span>
                <span class="sf-tint rounded-full px-2.5 py-0.5 text-xs font-semibold" :style="{ color: primary }">{{ statusLabel[m.status] || m.status }}</span>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                <template v-if="m.visitsTotal > 0">осталось {{ Math.max(0, m.visitsTotal - m.visitsUsed) }} из {{ m.visitsTotal }}</template>
                <template v-else>безлимит</template>
                <template v-if="m.endDate"> · до {{ m.endDate }}</template>
              </p>
            </div>
          </div>
        </Transition>

        <!-- Plans -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-for="p in plans" :key="p.id" class="sf-card sf-card--hover flex flex-col overflow-hidden">
            <div v-if="p.imageUrl" class="h-36 bg-cover bg-center" :style="{ backgroundImage: `url(${p.imageUrl})` }" />
            <div v-else class="h-1.5" :style="{ background: p.color || primary }" />
            <div class="flex flex-1 flex-col gap-2 p-5">
              <h3 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ p.name }}</h3>
              <p v-if="p.description" class="text-sm leading-6 text-gray-600 dark:text-gray-400">{{ p.description }}</p>
              <p class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <UIcon name="lucide:calendar-clock" class="h-3.5 w-3.5" /> {{ planLine(p) }}
              </p>
              <p class="mt-auto pt-3 text-2xl font-extrabold tracking-tight" :style="{ color: p.color || primary }">{{ money(p.price, p.currency) }}</p>
              <button v-if="brand.acceptRequests" type="button" class="sf-btn sf-btn--block mt-1" :style="{ '--brand': p.color || primary }" @click="startRequest(p)">
                Оформить абонемент
              </button>
            </div>
          </div>
        </div>
        <p v-if="!plans.length" class="py-10 text-center text-gray-500">Абонементы пока не добавлены.</p>

        <div v-if="mapSrc" class="sf-card overflow-hidden">
          <iframe :src="mapSrc" class="h-56 w-full" loading="lazy" title="Карта расположения" />
          <a v-if="brand.address" :href="twoGisSearchHref(brand.address)" target="_blank" class="block py-3 text-center text-sm font-semibold" :style="{ color: primary }">Открыть на карте</a>
        </div>

        <p class="pt-2 text-center text-xs text-gray-400">
          <a :href="siteUrl" class="hover:underline">Powered by lota</a>
        </p>
      </div>
    </div>

    <!-- Request sheet -->
    <UModal v-model="sheetOpen" :ui="{ rounded: 'rounded-[2rem]', background: 'bg-white dark:bg-[#1a1a1a]', ring: 'ring-1 ring-black/5 dark:ring-white/10', shadow: 'shadow-2xl' }">
      <div class="sf-fields p-6" :style="brandVars">
        <template v-if="submittedOk">
          <div class="py-4 text-center">
            <span class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full" :style="{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: primary }">
              <UIcon name="lucide:check" class="h-8 w-8" />
            </span>
            <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Заявка отправлена</h2>
            <p class="mt-1 text-sm text-gray-500">С вами свяжутся для подтверждения абонемента.</p>
            <button type="button" class="sf-btn mt-5" @click="sheetOpen = false">Готово</button>
          </div>
        </template>
        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="sf-label">Оформление</p>
              <h2 class="truncate text-xl font-bold tracking-tight text-gray-900 dark:text-white">{{ chosenPlan?.name }}</h2>
            </div>
            <button type="button" class="sf-sheet-close" aria-label="Закрыть" @click="sheetOpen = false"><UIcon name="lucide:x" class="h-4 w-4" /></button>
          </div>
          <p class="sf-tint mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold" :style="{ color: primary }">
            {{ chosenPlan ? money(chosenPlan.price, chosenPlan.currency) : '' }}
          </p>
          <div class="mt-4 space-y-3">
            <UFormGroup label="Имя" required><UInput v-model="reqForm.name" size="lg" /></UFormGroup>
            <UFormGroup label="Телефон" required><UInput v-model="reqForm.phone" size="lg" placeholder="+7..." /></UFormGroup>
            <UFormGroup label="Комментарий"><UTextarea v-model="reqForm.note" :rows="2" /></UFormGroup>
          </div>
          <div class="mt-5 flex items-center justify-end gap-2">
            <button type="button" class="rounded-full px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" @click="sheetOpen = false">Отмена</button>
            <button type="button" class="sf-btn" :disabled="submitting || !reqForm.name.trim() || !reqForm.phone.trim()" @click="submitRequest">
              <UIcon v-if="submitting" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
              Отправить заявку
            </button>
          </div>
        </template>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.sf-fade-enter-active, .sf-fade-leave-active { transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1); }
.sf-fade-enter-from, .sf-fade-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
