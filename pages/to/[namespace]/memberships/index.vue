<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { resolveSiteUrl } from '@/utils/siteUrl';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { telHref, whatsappHref } from '@/utils/phoneLinks';
import { twoGisSearchHref, osmEmbedSrc } from '@/utils/geo';
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
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div
      v-if="loading"
      class="min-h-screen flex items-center justify-center"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-8 h-8 animate-spin text-gray-400"
      />
    </div>
    <div
      v-else-if="error"
      class="min-h-screen flex items-center justify-center p-6 text-center"
    >
      <div>
        <UIcon
          name="lucide:store"
          class="w-10 h-10 mx-auto text-gray-300 mb-3"
        />
        <p class="text-gray-600 dark:text-gray-300">
          {{ error }}
        </p>
      </div>
    </div>

    <div v-else-if="brand">
      <!-- Brand hero -->
      <div class="relative">
        <div
          class="h-32 sm:h-44 w-full"
          :style="{ background: primary }"
        />
        <div class="max-w-3xl mx-auto px-4">
          <div class="-mt-10 flex items-end gap-3">
            <img
              v-if="brand.logoUrl"
              :src="brand.logoUrl"
              class="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-gray-950 bg-white shrink-0"
            >
            <div class="pb-1 min-w-0">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {{ brand.name || 'Абонементы' }}
              </h1>
              <p
                v-if="brand.city || brand.address"
                class="text-sm text-gray-500 truncate"
              >
                {{ [brand.address, brand.city].filter(Boolean).join(', ') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <p
          v-if="brand.welcomeMessage"
          class="text-gray-700 dark:text-gray-300"
        >
          {{ brand.welcomeMessage }}
        </p>

        <div class="flex flex-wrap gap-2">
          <a
            v-if="brand.phone"
            :href="telHref(brand.phone)"
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <UIcon
              name="lucide:phone"
              class="w-4 h-4"
            /> {{ brand.phone }}
          </a>
          <a
            v-if="brand.phone"
            :href="whatsappHref(brand.phone)"
            target="_blank"
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <UIcon
              name="lucide:message-circle"
              class="w-4 h-4"
            /> WhatsApp
          </a>
          <a
            v-for="s in social"
            :key="s.url"
            :href="s.url"
            target="_blank"
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <UIcon
              name="lucide:link"
              class="w-4 h-4"
            /> {{ s.label }}
          </a>
          <button
            v-if="patronToken"
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            @click="myOpen = !myOpen; loadMyMemberships()"
          >
            <UIcon
              name="lucide:ticket"
              class="w-4 h-4"
            /> Мои абонементы
          </button>
          <button
            v-else
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            @click="loginHere()"
          >
            <UIcon
              name="lucide:log-in"
              class="w-4 h-4"
            /> Войти
          </button>
        </div>

        <div
          v-if="myOpen && patronToken"
          class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        >
          <p
            v-if="!myMemberships.length"
            class="text-sm text-gray-500"
          >
            У вас пока нет абонементов в этом заведении.
          </p>
          <div
            v-for="m in myMemberships"
            :key="m.id"
            class="py-2 border-b last:border-0 border-gray-100 dark:border-gray-700"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ m.planNameSnapshot }}</span>
              <span class="text-xs text-gray-500">{{ statusLabel[m.status] || m.status }}</span>
            </div>
            <p class="text-xs text-gray-500">
              <template v-if="m.visitsTotal > 0">
                осталось {{ Math.max(0, m.visitsTotal - m.visitsUsed) }} из {{ m.visitsTotal }}
              </template>
              <template v-else>
                безлимит
              </template>
              <template v-if="m.endDate">
                · до {{ m.endDate }}
              </template>
            </p>
          </div>
        </div>

        <!-- Plans -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="p in plans"
            :key="p.id"
            class="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 flex flex-col"
          >
            <div
              v-if="p.imageUrl"
              class="h-32 bg-center bg-cover"
              :style="{ backgroundImage: `url(${p.imageUrl})` }"
            />
            <div
              v-else
              class="h-2"
              :style="{ background: p.color || primary }"
            />
            <div class="p-4 flex flex-col flex-1 gap-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ p.name }}
              </h3>
              <p
                v-if="p.description"
                class="text-sm text-gray-600 dark:text-gray-400"
              >
                {{ p.description }}
              </p>
              <p class="text-sm text-gray-500">
                {{ planLine(p) }}
              </p>
              <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-auto">
                {{ money(p.price, p.currency) }}
              </p>
              <UButton
                v-if="brand.acceptRequests"
                block
                :style="{ background: primary, color: onPrimary }"
                @click="startRequest(p)"
              >
                Оформить абонемент
              </UButton>
            </div>
          </div>
        </div>
        <p
          v-if="!plans.length"
          class="text-center text-gray-500 py-8"
        >
          Абонементы пока не добавлены.
        </p>

        <div
          v-if="mapSrc"
          class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <iframe
            :src="mapSrc"
            class="w-full h-56"
            loading="lazy"
          />
          <a
            v-if="brand.address"
            :href="twoGisSearchHref(brand.address)"
            target="_blank"
            class="block text-center text-sm py-2 text-primary-600 dark:text-primary-400"
          >Открыть на карте</a>
        </div>

        <p class="text-center text-xs text-gray-400 pt-4">
          <a
            :href="siteUrl"
            class="hover:underline"
          >Powered by lota</a>
        </p>
      </div>
    </div>

    <!-- Request sheet -->
    <UModal v-model="sheetOpen">
      <div class="p-5 space-y-3">
        <template v-if="submittedOk">
          <div class="text-center py-4">
            <UIcon
              name="lucide:check-circle"
              class="w-12 h-12 mx-auto text-emerald-500 mb-2"
            />
            <h2 class="text-lg font-semibold">
              Заявка отправлена
            </h2>
            <p class="text-sm text-gray-500 mt-1">
              С вами свяжутся для подтверждения абонемента.
            </p>
            <UButton
              class="mt-4"
              color="primary"
              @click="sheetOpen = false"
            >
              Готово
            </UButton>
          </div>
        </template>
        <template v-else>
          <h2 class="text-lg font-semibold">
            Оформление: {{ chosenPlan?.name }}
          </h2>
          <p class="text-sm text-gray-500">
            {{ chosenPlan ? money(chosenPlan.price, chosenPlan.currency) : '' }}
          </p>
          <UFormGroup
            label="Имя"
            required
          >
            <UInput v-model="reqForm.name" />
          </UFormGroup>
          <UFormGroup
            label="Телефон"
            required
          >
            <UInput
              v-model="reqForm.phone"
              placeholder="+7..."
            />
          </UFormGroup>
          <UFormGroup label="Комментарий">
            <UTextarea
              v-model="reqForm.note"
              :rows="2"
            />
          </UFormGroup>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="ghost"
              @click="sheetOpen = false"
            >
              Отмена
            </UButton>
            <UButton
              :loading="submitting"
              :disabled="!reqForm.name.trim() || !reqForm.phone.trim()"
              color="primary"
              @click="submitRequest"
            >
              Отправить заявку
            </UButton>
          </div>
        </template>
      </div>
    </UModal>
  </div>
</template>
