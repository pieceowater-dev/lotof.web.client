<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import ImageUpload from '@/components/menu/ImageUpload.vue';
import { getContrastTextColor } from '@/utils/color';
import { parseSocialLinks, serializeSocialLinks, socialIcon, SOCIAL_PLATFORMS, type SocialLink } from '@/utils/social';
import { CURRENCIES, formatMoney } from '@/utils/currency';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

type SectionKey = 'identity' | 'colors' | 'social' | 'seo';
const activeSection = ref<SectionKey>('identity');
const sections = computed(() => [
  { key: 'identity' as SectionKey, label: t('menu.identity') || 'Identity', icon: 'lucide:store' },
  { key: 'colors' as SectionKey, label: t('menu.colors') || 'Colors', icon: 'lucide:palette' },
  { key: 'social' as SectionKey, label: t('menu.socialLinks') || 'Social links', icon: 'lucide:share-2' },
  { key: 'seo' as SectionKey, label: 'SEO', icon: 'lucide:search' },
]);

const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const form = reactive({
  name: '',
  logoUrl: '',
  logoAlt: '',
  primaryColor: '',
  secondaryColor: '',
  welcomeMessage: '',
  currencyCode: 'KZT',
  seoTitle: '',
  seoDescription: '',
});
const socialLinksList = ref<SocialLink[]>([]);

function applySettings(s: MenuBrandSettings | null) {
  if (!s) return;
  form.name = s.name || '';
  form.logoUrl = s.logoUrl || '';
  form.logoAlt = s.logoAlt || '';
  form.primaryColor = s.primaryColor || '';
  form.secondaryColor = s.secondaryColor || '';
  form.welcomeMessage = s.welcomeMessage || '';
  form.currencyCode = s.currencyCode || 'KZT';
  socialLinksList.value = parseSocialLinks(s.socialLinks);
  form.seoTitle = s.seoTitle || '';
  form.seoDescription = s.seoDescription || '';
}

function addSocialLink() {
  socialLinksList.value.push({ name: 0, link: '' });
}
function removeSocialLink(idx: number) {
  socialLinksList.value.splice(idx, 1);
}
const platformOptions = SOCIAL_PLATFORMS.map((p) => ({ label: p.label, value: p.value }));
function placeholderFor(name: number): string {
  return SOCIAL_PLATFORMS.find((p) => p.value === name)?.placeholder || 'https://...';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) throw new Error('No menu token');
    const { menuGetBrandSettings } = await import('@/api/menu/brandsettings/get');
    const settings = await menuGetBrandSettings(menuToken, nsSlug.value);
    applySettings(settings);
  } catch (e) {
    logError('[menu/settings/brand] load failed', e);
    error.value = getErrorMessage(e) || 'Failed to load brand settings';
  } finally {
    loading.value = false;
  }
}

const isFormValid = computed(() => form.name.trim().length > 0);

async function save() {
  if (!isFormValid.value) return;
  saving.value = true;
  error.value = null;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) throw new Error('No menu token');
    const { menuUpsertBrandSettings } = await import('@/api/menu/brandsettings/upsert');
    const settings = await menuUpsertBrandSettings(menuToken, nsSlug.value, {
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || undefined,
      logoAlt: form.logoAlt.trim() || undefined,
      primaryColor: form.primaryColor.trim() || undefined,
      secondaryColor: form.secondaryColor.trim() || undefined,
      welcomeMessage: form.welcomeMessage.trim() || undefined,
      currencyCode: form.currencyCode.trim() || undefined,
      socialLinks: serializeSocialLinks(socialLinksList.value),
      seoTitle: form.seoTitle.trim() || undefined,
      seoDescription: form.seoDescription.trim() || undefined,
    });
    applySettings(settings);
    useToast().add({ title: t('menu.brandSettingsSaved') || 'Saved', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/brand] save failed', e);
    error.value = getErrorMessage(e) || 'Failed to save brand settings';
  } finally {
    saving.value = false;
  }
}

const previewPrimary = computed(() => /^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : '#3b82f6');
const previewSecondary = computed(() => /^#[0-9a-fA-F]{6}$/.test(form.secondaryColor) ? form.secondaryColor : '#64748b');
const previewOnPrimaryText = computed(() => getContrastTextColor(previewPrimary.value));

onMounted(load);
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

    <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
      <div class="space-y-4">
        <!-- Section switcher: one focused panel at a time instead of a long
             vertical stack of every field — cuts scrolling and lets each
             section breathe. -->
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
            <UIcon :name="s.icon" class="w-4 h-4" />
            {{ s.label }}
          </button>
        </div>

        <!-- Identity -->
        <div v-if="activeSection === 'identity'" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div class="flex flex-col sm:flex-row gap-4">
            <ImageUpload v-model="form.logoUrl" :ns-slug="nsSlug" aspect="square" fit="contain" />
            <div class="flex-1 space-y-4 min-w-0">
              <UFormGroup :label="t('menu.name') || 'Name'" required>
                <UInput v-model="form.name" size="lg" />
              </UFormGroup>
              <UFormGroup :label="t('menu.logoAlt') || 'Logo alt text'">
                <UInput v-model="form.logoAlt" size="lg" />
              </UFormGroup>
            </div>
          </div>

          <UFormGroup :label="t('menu.welcomeMessage') || 'Welcome message'">
            <UTextarea v-model="form.welcomeMessage" :rows="2" />
          </UFormGroup>

          <UFormGroup :label="t('menu.currencyCode') || 'Currency'">
            <USelectMenu v-model="form.currencyCode" :options="currencyOptions" value-attribute="value" option-attribute="label" size="lg" class="max-w-[180px]" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
        </div>

        <!-- Colors -->
        <div v-else-if="activeSection === 'colors'" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormGroup :label="t('menu.primaryColor') || 'Primary color'">
              <div class="flex items-center gap-2">
                <input v-model="form.primaryColor" type="color" class="h-9 w-10 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent flex-shrink-0">
                <UInput v-model="form.primaryColor" size="lg" placeholder="#3b82f6" class="flex-1" />
              </div>
            </UFormGroup>
            <UFormGroup :label="t('menu.secondaryColor') || 'Secondary color'">
              <div class="flex items-center gap-2">
                <input v-model="form.secondaryColor" type="color" class="h-9 w-10 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent flex-shrink-0">
                <UInput v-model="form.secondaryColor" size="lg" placeholder="#3e5f52" class="flex-1" />
              </div>
            </UFormGroup>
          </div>
        </div>

        <!-- Social links: shown as call/social buttons on the storefront
             header + footer (see pages/to/[namespace]/menu/index.vue) -->
        <div v-else-if="activeSection === 'social'" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('menu.socialLinksHint') || 'Shown as quick-action buttons on your storefront.' }}</span>
            <UButton size="2xs" color="gray" variant="soft" icon="lucide:plus" @click="addSocialLink">
              {{ t('menu.addSocialLink') || 'Add' }}
            </UButton>
          </div>
          <div v-if="!socialLinksList.length" class="text-sm text-gray-400">{{ t('menu.noSocialLinks') || 'No social links yet' }}</div>
          <div v-for="(link, idx) in socialLinksList" :key="idx" class="flex items-center gap-2">
            <Icon :name="socialIcon(link.name)" class="h-4 w-4 text-gray-400 flex-shrink-0" />
            <USelectMenu v-model="link.name" :options="platformOptions" value-attribute="value" option-attribute="label" size="sm" class="w-36 flex-shrink-0" :popper="{ strategy: 'fixed' }" />
            <UInput v-model="link.link" size="sm" :placeholder="placeholderFor(link.name)" class="flex-1" />
            <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="removeSocialLink(idx)" />
          </div>
        </div>

        <!-- SEO -->
        <div v-else-if="activeSection === 'seo'" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <UFormGroup :label="t('menu.seoTitle') || 'SEO title'">
            <UInput v-model="form.seoTitle" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('menu.seoDescription') || 'SEO description'">
            <UTextarea v-model="form.seoDescription" :rows="2" />
          </UFormGroup>
        </div>

        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="saving"
            :disabled="!isFormValid || saving"
            @click="save"
          >
            {{ t('menu.saveBrandSettings') || 'Save' }}
          </UButton>
        </div>
      </div>

      <!-- Live preview of the storefront header -->
      <div class="lg:sticky lg:top-4">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {{ t('menu.preview') || 'Preview' }}
        </div>
        <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <!-- Mirrors the storefront's hero header exactly (see
               pages/to/[namespace]/menu/index.vue) so this preview never
               drifts out of sync with what customers actually see. -->
          <div class="p-4 pb-5 flex items-center gap-3" :style="{ backgroundColor: previewPrimary }">
            <div class="w-14 h-14 rounded-2xl bg-white shadow ring-2 ring-white/30 flex-shrink-0 overflow-hidden flex items-center justify-center">
              <img
                v-if="form.logoUrl"
                :src="form.logoUrl"
                :alt="form.logoAlt || form.name"
                class="w-full h-full object-contain p-1"
              >
              <Icon v-else name="lucide:store" class="h-5 w-5 text-gray-300" />
            </div>
            <div class="min-w-0">
              <div class="text-base font-bold truncate" :style="{ color: previewOnPrimaryText }">{{ form.name || (t('menu.name') || 'Name') }}</div>
              <div v-if="form.welcomeMessage" class="text-xs truncate" :style="{ color: previewOnPrimaryText, opacity: 0.85 }">{{ form.welcomeMessage }}</div>
            </div>
          </div>
          <div class="p-4 space-y-2.5">
            <button
              class="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              :style="{ backgroundColor: previewPrimary, color: previewOnPrimaryText }"
            >
              {{ t('menu.addToCart') || 'Add to cart' }}
            </button>
            <div
              class="w-full rounded-lg px-3 py-2 text-sm font-medium text-center border"
              :style="{ borderColor: previewSecondary, color: previewSecondary }"
            >
              {{ formatMoney(12, form.currencyCode) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
