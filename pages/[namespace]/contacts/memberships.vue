<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import MembershipBrandSection from '@/components/contacts/memberships/MembershipBrandSection.vue';
import MembershipImageUpload from '@/components/contacts/memberships/MembershipImageUpload.vue';
import ColorField from '@/components/contacts/memberships/ColorField.vue';
import {
  listMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  listMembershipRequests,
  approveClientMembership,
  rejectClientMembership,
  getMembershipBrandSettings,
  type MembershipPlan,
  type MembershipPlanInput,
  type ClientMembership,
  type MembershipBrandSettings,
} from '@/api/contacts/memberships';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
useHead(() => ({ title: nsTitle.value ? `Абонементы — Contacts — ${nsTitle.value}` : 'Абонементы — Contacts' }));

const contactsToken = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const tab = ref<'plans' | 'requests' | 'brand'>('plans');

const plans = ref<MembershipPlan[]>([]);
const requests = ref<ClientMembership[]>([]);
const brand = ref<MembershipBrandSettings | null>(null);

const goBack = () => (process.client ? window.history.back() : router.back());

function fail(e: unknown, fallback: string) {
  const msg = getErrorMessage(e, t) || fallback;
  toast.add({ title: t('common.error') || 'Ошибка', description: msg, color: 'red' });
  logError('[memberships]', e);
}

async function loadAll() {
  loading.value = true;
  error.value = null;
  try {
    if (!hubToken.value) {
      error.value = t('common.errorDetails.missingCredentials') || 'Нет доступа';
      return;
    }
    const tok = await ensure(nsSlug.value, hubToken.value);
    if (!tok) {
      error.value = t('common.errorDetails.missingCredentials') || 'Нет доступа';
      return;
    }
    contactsToken.value = tok;
    await Promise.all([reloadPlans(), reloadRequests(), reloadBrand()]);
  } catch (e) {
    error.value = getErrorMessage(e, t) || (t('common.errorDetails.loadFailed') || 'Не удалось загрузить');
  } finally {
    loading.value = false;
  }
}

async function reloadPlans() {
  try {
    plans.value = (await listMembershipPlans(contactsToken.value)).rows;
  } catch (e) {
    fail(e, 'Не удалось загрузить абонементы');
  }
}
async function reloadRequests() {
  try {
    requests.value = await listMembershipRequests(contactsToken.value);
  } catch (e) {
    fail(e, 'Не удалось загрузить заявки');
  }
}
async function reloadBrand() {
  try {
    brand.value = await getMembershipBrandSettings(contactsToken.value);
  } catch (e) {
    fail(e, 'Не удалось загрузить публичную страницу');
  }
}

onMounted(loadAll);

// ── Plan modal ──────────────────────────────────────────────────────────
const planModalOpen = ref(false);
const editingId = ref<string | null>(null);
const savingPlan = ref(false);
const blankForm = (): MembershipPlanInput & { clearPin: boolean } => ({
  name: '',
  description: '',
  price: '',
  currency: brand.value?.currencyCode || 'KZT',
  durationDays: 30,
  visitLimit: 8,
  freezeDaysAllowed: 0,
  color: '#4f46e5',
  imageUrl: '',
  category: '',
  status: 'ACTIVE',
  listedOnStorefront: true,
  sortOrder: 0,
  pin: '',
  clearPin: false,
});
const form = ref(blankForm());

function openNewPlan() {
  editingId.value = null;
  form.value = blankForm();
  planModalOpen.value = true;
}
function openEditPlan(p: MembershipPlan) {
  editingId.value = p.id;
  form.value = {
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    durationDays: p.durationDays,
    visitLimit: p.visitLimit,
    freezeDaysAllowed: p.freezeDaysAllowed,
    color: p.color || '#4f46e5',
    imageUrl: p.imageUrl,
    category: p.category,
    status: p.status,
    listedOnStorefront: p.listedOnStorefront,
    sortOrder: p.sortOrder,
    pin: '',
    clearPin: false,
  };
  planModalOpen.value = true;
}

async function savePlan() {
  if (!form.value.name.trim()) {
    toast.add({ title: 'Укажите название', color: 'amber' });
    return;
  }
  savingPlan.value = true;
  try {
    const payload: MembershipPlanInput & { id?: string; clearPin?: boolean } = {
      name: form.value.name.trim(),
      description: form.value.description || '',
      price: String(form.value.price || '0'),
      currency: form.value.currency || 'KZT',
      durationDays: Number(form.value.durationDays) || 0,
      visitLimit: Number(form.value.visitLimit) || 0,
      freezeDaysAllowed: Number(form.value.freezeDaysAllowed) || 0,
      color: form.value.color || '',
      imageUrl: form.value.imageUrl || '',
      category: form.value.category || '',
      status: form.value.status || 'ACTIVE',
      listedOnStorefront: !!form.value.listedOnStorefront,
      sortOrder: Number(form.value.sortOrder) || 0,
    };
    if (form.value.pin) payload.pin = form.value.pin;
    if (editingId.value) {
      payload.id = editingId.value;
      payload.clearPin = form.value.clearPin;
      await updateMembershipPlan(contactsToken.value, payload as any);
    } else {
      await createMembershipPlan(contactsToken.value, payload);
    }
    planModalOpen.value = false;
    await reloadPlans();
    toast.add({ title: t('common.success') || 'Сохранено', color: 'emerald' });
  } catch (e) {
    fail(e, 'Не удалось сохранить');
  } finally {
    savingPlan.value = false;
  }
}

async function archivePlan(p: MembershipPlan) {
  if (!confirm(`Архивировать «${p.name}»?`)) return;
  try {
    await deleteMembershipPlan(contactsToken.value, p.id);
    await reloadPlans();
  } catch (e) {
    fail(e, 'Не удалось архивировать');
  }
}

// ── Requests: approve / reject ─────────────────────────────────────────
const approveModalOpen = ref(false);
const approvingReq = ref<ClientMembership | null>(null);
const approveForm = ref({ startDate: '', pricePaid: '' });
const savingReq = ref(false);

function openApprove(r: ClientMembership) {
  approvingReq.value = r;
  approveForm.value = { startDate: new Date().toISOString().slice(0, 10), pricePaid: r.planPriceSnapshot || '' };
  approveModalOpen.value = true;
}
async function confirmApprove() {
  if (!approvingReq.value) return;
  savingReq.value = true;
  try {
    await approveClientMembership(contactsToken.value, {
      id: approvingReq.value.id,
      startDate: approveForm.value.startDate || undefined,
      pricePaid: approveForm.value.pricePaid || undefined,
    });
    approveModalOpen.value = false;
    await reloadRequests();
    toast.add({ title: 'Абонемент активирован', color: 'emerald' });
  } catch (e) {
    fail(e, 'Не удалось подтвердить');
  } finally {
    savingReq.value = false;
  }
}
async function rejectReq(r: ClientMembership) {
  const reason = prompt('Причина отклонения (необязательно):') ?? '';
  try {
    await rejectClientMembership(contactsToken.value, r.id, reason);
    await reloadRequests();
  } catch (e) {
    fail(e, 'Не удалось отклонить');
  }
}

// Brand/storefront editing lives in <MembershipBrandSection> (mirrors
// components/menu/settings/BrandSection.vue). reloadBrand() still refreshes
// the plan-modal currency default.

function fmtMoney(v: string, cur: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return `${v} ${cur}`;
  return `${n.toLocaleString('ru-KZ')} ${cur}`;
}
function planSummary(p: MembershipPlan) {
  const parts: string[] = [];
  parts.push(p.visitLimit > 0 ? `${p.visitLimit} посещений` : 'безлимит посещений');
  parts.push(p.durationDays > 0 ? `${p.durationDays} дней` : 'бессрочно');
  return parts.join(' · ');
}
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('membership.nav') || 'Абонементы' }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ nsTitle }}</span>
      </div>
      <UButton
        icon="lucide:arrow-left"
        size="xs"
        color="primary"
        variant="soft"
        @click="goBack"
      >
        <span class="hidden sm:inline">{{ t('app.back') || 'Назад' }}</span>
      </UButton>
    </div>

    <div class="flex gap-1 mb-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="tt in (['plans', 'requests', 'brand'] as const)"
        :key="tt"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
        :class="tab === tt ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="tab = tt"
      >
        {{ tt === 'plans' ? 'Планы' : tt === 'requests' ? `Заявки${requests.length ? ` (${requests.length})` : ''}` : (t('membership.storefront') || 'Публичная страница') }}
      </button>
    </div>

    <div
      v-if="error"
      class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>
    <div
      v-if="loading"
      class="flex items-center justify-center flex-1"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else
      class="flex-1 min-h-0 overflow-y-auto"
    >
      <!-- PLANS -->
      <div v-show="tab === 'plans'">
        <div class="flex justify-end mb-3">
          <UButton
            icon="lucide:plus"
            size="sm"
            color="primary"
            @click="openNewPlan"
          >
            Новый абонемент
          </UButton>
        </div>
        <div
          v-if="!plans.length"
          class="text-center py-12 text-gray-500"
        >
          Пока нет ни одного абонемента
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="p in plans"
            :key="p.id"
            class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800"
          >
            <div
              class="h-2"
              :style="{ background: p.color || '#4f46e5' }"
            />
            <div class="p-4 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ p.name }}
                </h3>
                <UBadge
                  :color="p.status === 'ACTIVE' ? 'emerald' : 'gray'"
                  variant="soft"
                  size="xs"
                >
                  {{ p.status === 'ACTIVE' ? 'активен' : p.status === 'INACTIVE' ? 'выключен' : 'архив' }}
                </UBadge>
              </div>
              <p
                v-if="p.description"
                class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
              >
                {{ p.description }}
              </p>
              <p class="text-sm text-gray-500">
                {{ planSummary(p) }}
              </p>
              <p class="text-lg font-bold text-gray-900 dark:text-gray-100">
                {{ fmtMoney(p.price, p.currency) }}
              </p>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span
                  v-if="p.listedOnStorefront"
                  class="inline-flex items-center gap-1"
                ><UIcon
                  name="lucide:store"
                  class="w-3 h-3"
                /> на странице</span>
                <span
                  v-if="p.hasPin"
                  class="inline-flex items-center gap-1"
                ><UIcon
                  name="lucide:lock"
                  class="w-3 h-3"
                /> PIN</span>
                <span v-if="p.category">{{ p.category }}</span>
              </div>
              <div class="flex gap-2 pt-1">
                <UButton
                  size="xs"
                  variant="soft"
                  icon="lucide:pencil"
                  @click="openEditPlan(p)"
                >
                  Изменить
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="red"
                  icon="lucide:archive"
                  @click="archivePlan(p)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- REQUESTS -->
      <div v-show="tab === 'requests'">
        <div
          v-if="!requests.length"
          class="text-center py-12 text-gray-500"
        >
          Нет новых заявок с публичной страницы
        </div>
        <div class="space-y-3">
          <div
            v-for="r in requests"
            :key="r.id"
            class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
          >
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold">
                    {{ r.planNameSnapshot }}
                  </h3>
                  <UBadge
                    color="amber"
                    variant="soft"
                    size="xs"
                  >
                    ожидает
                  </UBadge>
                </div>
                <p class="text-sm text-gray-500">
                  {{ fmtMoney(r.planPriceSnapshot, r.currency) }} · заявка от {{ new Date(r.createdAt).toLocaleString('ru-RU') }}
                </p>
                <p
                  v-if="r.requestNote"
                  class="text-sm text-gray-600 dark:text-gray-400 mt-1"
                >
                  «{{ r.requestNote }}»
                </p>
                <NuxtLink
                  :to="`/${nsSlug}/contacts/${r.clientId}`"
                  class="text-xs text-primary-600 dark:text-primary-400 inline-flex items-center gap-1 mt-1"
                >
                  <UIcon
                    name="lucide:user"
                    class="w-3 h-3"
                  /> карточка клиента
                </NuxtLink>
              </div>
              <div class="flex gap-2">
                <UButton
                  size="xs"
                  color="emerald"
                  icon="lucide:check"
                  @click="openApprove(r)"
                >
                  Подтвердить
                </UButton>
                <UButton
                  size="xs"
                  color="red"
                  variant="soft"
                  icon="lucide:x"
                  @click="rejectReq(r)"
                >
                  Отклонить
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BRAND -->
      <div v-show="tab === 'brand'">
        <MembershipBrandSection
          v-if="contactsToken"
          :token="contactsToken"
          :ns-slug="nsSlug"
        />
      </div>
    </div>

    <!-- Plan modal -->
    <UModal v-model="planModalOpen">
      <div class="p-5 space-y-3">
        <h2 class="text-lg font-semibold">
          {{ editingId ? 'Изменить абонемент' : 'Новый абонемент' }}
        </h2>
        <UFormGroup
          label="Название"
          required
        >
          <UInput v-model="form.name" />
        </UFormGroup>
        <UFormGroup label="Описание">
          <UTextarea
            v-model="form.description"
            :rows="2"
          />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup label="Цена">
            <UInput
              v-model="form.price"
              type="number"
            />
          </UFormGroup>
          <UFormGroup label="Валюта">
            <UInput v-model="form.currency" />
          </UFormGroup>
          <UFormGroup label="Срок, дней (0 = бессрочно)">
            <UInput
              v-model.number="form.durationDays"
              type="number"
            />
          </UFormGroup>
          <UFormGroup label="Посещений (0 = безлимит)">
            <UInput
              v-model.number="form.visitLimit"
              type="number"
            />
          </UFormGroup>
          <UFormGroup label="Дней заморозки">
            <UInput
              v-model.number="form.freezeDaysAllowed"
              type="number"
            />
          </UFormGroup>
          <UFormGroup label="Категория">
            <UInput
              v-model="form.category"
              placeholder="Тренажёрный зал"
            />
          </UFormGroup>
        </div>
        <UFormGroup label="Статус">
          <USelect
            v-model="form.status"
            class="max-w-[200px]"
            :options="[{ value: 'ACTIVE', label: 'Активен' }, { value: 'INACTIVE', label: 'Выключен' }, { value: 'ARCHIVED', label: 'Архив' }]"
          />
        </UFormGroup>
        <UFormGroup label="Цвет плашки">
          <ColorField v-model="form.color" />
        </UFormGroup>
        <UFormGroup label="Фото абонемента">
          <MembershipImageUpload
            v-model="form.imageUrl"
            aspect="wide"
            fit="cover"
            :max-dimension="1000"
          />
        </UFormGroup>
        <label class="flex items-center gap-2 text-sm"><UToggle v-model="form.listedOnStorefront" /> Показывать на публичной странице</label>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup label="PIN для отметки посещений (4 цифры)">
            <UInput
              v-model="form.pin"
              type="password"
              inputmode="numeric"
              autocomplete="new-password"
              placeholder="••••"
              maxlength="4"
              @input="form.pin = (form.pin || '').replace(/\D/g, '').slice(0, 4)"
            />
          </UFormGroup>
          <label
            v-if="editingId"
            class="flex items-center gap-2 text-sm mt-6"
          ><UToggle v-model="form.clearPin" /> Убрать PIN</label>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            variant="ghost"
            @click="planModalOpen = false"
          >
            Отмена
          </UButton>
          <UButton
            :loading="savingPlan"
            color="primary"
            @click="savePlan"
          >
            Сохранить
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- Approve modal -->
    <UModal v-model="approveModalOpen">
      <div class="p-5 space-y-3">
        <h2 class="text-lg font-semibold">
          Подтвердить заявку
        </h2>
        <p class="text-sm text-gray-500">
          {{ approvingReq?.planNameSnapshot }}
        </p>
        <UFormGroup label="Дата начала">
          <UInput
            v-model="approveForm.startDate"
            type="date"
          />
        </UFormGroup>
        <UFormGroup label="Оплачено">
          <UInput
            v-model="approveForm.pricePaid"
            type="number"
          />
        </UFormGroup>
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            variant="ghost"
            @click="approveModalOpen = false"
          >
            Отмена
          </UButton>
          <UButton
            :loading="savingReq"
            color="emerald"
            @click="confirmApprove"
          >
            Активировать
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
