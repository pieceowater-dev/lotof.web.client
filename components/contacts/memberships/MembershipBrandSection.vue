<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { CURRENCIES } from '@/utils/currency';
import MembershipImageUpload from '@/components/contacts/memberships/MembershipImageUpload.vue';
import ColorField from '@/components/contacts/memberships/ColorField.vue';
import BranchLocationPicker from '@/components/menu/BranchLocationPicker.vue';
import {
  getMembershipBrandSettings,
  upsertMembershipBrandSettings,
  type MembershipBrandSettings,
} from '@/api/contacts/memberships';

// The lota Contacts equivalent of components/menu/settings/BrandSection.vue:
// section switcher (Profile / Colors / Contacts / SEO), sticky live preview
// mirroring the public memberships page hero, file-based logo upload and
// colour presets. Called the "публичная страница", never "витрина".
const { t } = useI18n();
const props = defineProps<{ token: string; nsSlug: string }>();

type SectionKey = 'identity' | 'colors' | 'contact' | 'seo';
const activeSection = ref<SectionKey>('identity');
const sections = computed(() => [
  { key: 'identity' as SectionKey, label: t('membership.identity') || 'Профиль', icon: 'lucide:store' },
  { key: 'colors' as SectionKey, label: t('membership.colors') || 'Цвета', icon: 'lucide:palette' },
  { key: 'contact' as SectionKey, label: t('membership.contactSection') || 'Контакты', icon: 'lucide:map-pin' },
  { key: 'seo' as SectionKey, label: 'SEO', icon: 'lucide:search' },
]);
const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

const form = reactive({
  name: '',
  logoUrl: '',
  primaryColor: '#4f46e5',
  welcomeMessage: '',
  currencyCode: 'KZT',
  socialLinks: '',
  seoTitle: '',
  seoDescription: '',
  address: '',
  city: '',
  phone: '',
  lat: 0,
  lng: 0,
  acceptRequests: true,
  autoApproveRequests: false,
  listedInCatalog: true,
});

function apply(s: MembershipBrandSettings | null) {
  if (!s) return;
  form.name = s.name || '';
  form.logoUrl = s.logoUrl || '';
  form.primaryColor = s.primaryColor || '#4f46e5';
  form.welcomeMessage = s.welcomeMessage || '';
  form.currencyCode = s.currencyCode || 'KZT';
  form.socialLinks = s.socialLinks || '';
  form.seoTitle = s.seoTitle || '';
  form.seoDescription = s.seoDescription || '';
  form.address = s.address || '';
  form.city = s.city || '';
  form.phone = s.phone || '';
  form.lat = s.lat || 0;
  form.lng = s.lng || 0;
  form.acceptRequests = s.acceptRequests ?? true;
  form.autoApproveRequests = s.autoApproveRequests ?? false;
  form.listedInCatalog = s.listedInCatalog ?? true;
}

// The storefront's socialLinks is a free JSON string; expose it as editable rows.
const socialRows = ref<Array<{ label: string; url: string }>>([]);
function syncSocialFromForm() {
  socialRows.value = [];
  const raw = form.socialLinks?.trim();
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) socialRows.value = obj.map((x) => ({ label: String(x.label || x.name || ''), url: String(x.url || '') }));
    else socialRows.value = Object.entries(obj).map(([k, v]) => ({ label: k, url: String(v) }));
  } catch { /* leave empty */ }
}
function syncSocialToForm() {
  const clean = socialRows.value.filter((r) => r.url.trim());
  form.socialLinks = clean.length ? JSON.stringify(Object.fromEntries(clean.map((r) => [r.label.trim() || 'link', r.url.trim()]))) : '';
}
watch(socialRows, syncSocialToForm, { deep: true });

async function load() {
  loading.value = true;
  error.value = null;
  try {
    apply(await getMembershipBrandSettings(props.token));
    syncSocialFromForm();
  } catch (e) {
    logError('[membership brand] load', e);
    error.value = getErrorMessage(e, t) || 'Не удалось загрузить страницу';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const isValid = computed(() => form.name.trim().length > 0);

async function save() {
  if (!isValid.value) return;
  saving.value = true;
  error.value = null;
  try {
    const s = await upsertMembershipBrandSettings(props.token, {
      name: form.name.trim(),
      logoUrl: form.logoUrl,
      coverImageUrl: '',
      primaryColor: form.primaryColor,
      secondaryColor: '',
      welcomeMessage: form.welcomeMessage.trim(),
      currencyCode: form.currencyCode,
      socialLinks: form.socialLinks,
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
      acceptRequests: form.acceptRequests,
      autoApproveRequests: form.autoApproveRequests,
      listedInCatalog: form.listedInCatalog,
    });
    apply(s);
    useToast().add({ title: t('common.success') || 'Страница сохранена', color: 'emerald' });
  } catch (e) {
    logError('[membership brand] save', e);
    error.value = getErrorMessage(e, t) || 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

const hex = (v: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
const previewPrimary = computed(() => hex(form.primaryColor, '#4f46e5'));

const storefrontUrl = computed(() => `${(process.client && window.location.origin) || ''}/to/${props.nsSlug}/memberships`);
function copyUrl() {
  if (process.client) navigator.clipboard?.writeText(storefrontUrl.value);
  useToast().add({ title: t('membership.linkCopied') || 'Ссылка скопирована', color: 'emerald' });
}
</script>

<template>
  <div>
    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>
    <div
      v-if="loading"
      class="flex items-center justify-center py-16"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else
      class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start"
    >
      <div class="space-y-4">
        <!-- storefront link -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('membership.storefrontLink') || 'Ссылка на страницу' }}
            </div>
            <div class="text-xs text-gray-500 break-all">
              {{ storefrontUrl }}
            </div>
          </div>
          <UButton
            size="2xs"
            color="gray"
            variant="soft"
            icon="lucide:copy"
            @click="copyUrl"
          >
            {{ t('app.copy') || 'Копировать' }}
          </UButton>
        </div>

        <!-- section switcher -->
        <div class="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-1">
          <button
            v-for="s in sections"
            :key="s.key"
            type="button"
            class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="activeSection === s.key
              ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            @click="activeSection = s.key"
          >
            <UIcon
              :name="s.icon"
              class="w-4 h-4"
            />
            {{ s.label }}
          </button>
        </div>

        <!-- Identity -->
        <div
          v-if="activeSection === 'identity'"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
        >
          <div class="flex flex-col sm:flex-row gap-4">
            <MembershipImageUpload
              v-model="form.logoUrl"
              aspect="square"
              fit="contain"
              :max-dimension="512"
            />
            <div class="flex-1 space-y-4 min-w-0">
              <UFormGroup
                :label="t('membership.brandName') || 'Название заведения'"
                required
              >
                <UInput
                  v-model="form.name"
                  size="lg"
                  placeholder="Мой фитнес-клуб"
                />
              </UFormGroup>
              <UFormGroup :label="t('membership.currency') || 'Валюта'">
                <USelectMenu
                  v-model="form.currencyCode"
                  :options="currencyOptions"
                  value-attribute="value"
                  option-attribute="label"
                  size="lg"
                  class="max-w-[180px]"
                  :popper="{ strategy: 'fixed' }"
                />
              </UFormGroup>
            </div>
          </div>
          <UFormGroup :label="t('membership.welcomeMessage') || 'Приветственный текст'">
            <UTextarea
              v-model="form.welcomeMessage"
              :rows="2"
              placeholder="Оформите абонемент онлайн за минуту"
            />
          </UFormGroup>

          <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('membership.acceptRequests') || 'Принимать заявки со страницы' }}
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ t('membership.acceptRequestsHint') || 'Клиенты видят кнопку «Оформить» и отправляют заявку.' }}
              </p>
            </div>
            <UToggle
              v-model="form.acceptRequests"
              class="flex-shrink-0"
            />
          </div>
          <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('membership.autoApprove') || 'Активировать сразу, без подтверждения' }}
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ t('membership.autoApproveHint') || 'Заявка сразу становится активным абонементом.' }}
              </p>
            </div>
            <UToggle
              v-model="form.autoApproveRequests"
              class="flex-shrink-0"
            />
          </div>
          <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('membership.listedInCatalog') || 'Показывать заведение в каталоге lota' }}
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ t('membership.listedInCatalogHint') || 'Заведение появится в общем каталоге на lota.' }}
              </p>
            </div>
            <UToggle
              v-model="form.listedInCatalog"
              class="flex-shrink-0"
            />
          </div>
        </div>

        <!-- Colors -->
        <div
          v-else-if="activeSection === 'colors'"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
        >
          <UFormGroup :label="t('membership.primaryColor') || 'Цвет бренда'">
            <ColorField v-model="form.primaryColor" />
          </UFormGroup>
          <p class="text-xs text-gray-400">
            {{ t('membership.primaryColorHint') || 'Используется для шапки страницы и кнопок «Оформить».' }}
          </p>
        </div>

        <!-- Contact -->
        <div
          v-else-if="activeSection === 'contact'"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
        >
          <UFormGroup :label="t('membership.address') || 'Адрес'">
            <UInput
              v-model="form.address"
              size="lg"
              placeholder="ул. Достык 1, Алматы"
            />
          </UFormGroup>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormGroup :label="t('membership.city') || 'Город'">
              <UInput
                v-model="form.city"
                size="lg"
              />
            </UFormGroup>
            <UFormGroup :label="t('membership.phone') || 'Телефон'">
              <UInput
                v-model="form.phone"
                size="lg"
                placeholder="+7..."
              />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('membership.pointOnMap') || 'Точка на карте'">
            <BranchLocationPicker
              :lat="form.lat || null"
              :lng="form.lng || null"
              @update="(la, ln) => { form.lat = la; form.lng = ln }"
            />
            <button
              v-if="form.lat && form.lng"
              type="button"
              class="mt-1.5 text-xs text-gray-400 hover:text-red-500"
              @click="form.lat = 0; form.lng = 0"
            >
              {{ t('membership.clearPoint') || 'Убрать точку' }}
            </button>
          </UFormGroup>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">{{ t('membership.socialLinksHint') || 'Показываются кнопками в шапке страницы.' }}</span>
              <UButton
                size="2xs"
                color="gray"
                variant="soft"
                icon="lucide:plus"
                @click="socialRows.push({ label: '', url: '' })"
              >
                {{ t('app.add') || 'Добавить' }}
              </UButton>
            </div>
            <div
              v-for="(row, i) in socialRows"
              :key="i"
              class="flex items-center gap-2"
            >
              <UInput
                v-model="row.label"
                size="sm"
                placeholder="instagram"
                class="w-40 flex-shrink-0"
              />
              <UInput
                v-model="row.url"
                size="sm"
                placeholder="https://..."
                class="flex-1"
              />
              <UButton
                icon="lucide:trash-2"
                size="2xs"
                color="red"
                variant="ghost"
                @click="socialRows.splice(i, 1)"
              />
            </div>
          </div>
        </div>

        <!-- SEO -->
        <div
          v-else-if="activeSection === 'seo'"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
        >
          <UFormGroup :label="t('membership.seoTitle') || 'SEO заголовок'">
            <UInput
              v-model="form.seoTitle"
              size="lg"
            />
          </UFormGroup>
          <UFormGroup :label="t('membership.seoDescription') || 'SEO описание'">
            <UTextarea
              v-model="form.seoDescription"
              :rows="2"
            />
          </UFormGroup>
        </div>

        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="saving"
            :disabled="!isValid || saving"
            icon="lucide:save"
            @click="save"
          >
            {{ t('membership.saveStorefront') || 'Сохранить страницу' }}
          </UButton>
        </div>
      </div>

      <!-- live preview -->
      <div class="lg:sticky lg:top-4">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {{ t('membership.preview') || 'Предпросмотр' }}
        </div>
        <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
          <div
            class="h-20"
            :style="{ background: previewPrimary }"
          />
          <div class="px-4 -mt-6 pb-4">
            <div class="flex items-end gap-3">
              <div class="w-14 h-14 rounded-2xl bg-white shadow ring-2 ring-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  v-if="form.logoUrl"
                  :src="form.logoUrl"
                  class="w-full h-full object-contain p-1"
                >
                <UIcon
                  v-else
                  name="lucide:dumbbell"
                  class="h-5 w-5 text-gray-300"
                />
              </div>
              <div class="min-w-0 flex-1 pb-1">
                <div class="text-base font-bold truncate text-gray-900 dark:text-white">
                  {{ form.name || (t('membership.brandName') || 'Название') }}
                </div>
                <div
                  v-if="form.city || form.address"
                  class="text-xs text-gray-400 truncate"
                >
                  {{ [form.address, form.city].filter(Boolean).join(', ') }}
                </div>
              </div>
            </div>
            <p
              v-if="form.welcomeMessage"
              class="mt-2 text-xs text-gray-500 line-clamp-2"
            >
              {{ form.welcomeMessage }}
            </p>
            <div class="mt-3 rounded-lg border border-gray-100 dark:border-gray-800 p-2.5">
              <div class="text-sm font-semibold text-gray-900 dark:text-white">
                Абонемент
              </div>
              <div class="text-xs text-gray-400">
                8 посещений · 30 дней
              </div>
              <button
                class="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold"
                :style="{ background: previewPrimary, color: '#ffffff' }"
              >
                {{ t('membership.checkout') || 'Оформить абонемент' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
