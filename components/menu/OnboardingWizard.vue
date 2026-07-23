<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import ImageUpload from '@/components/menu/ImageUpload.vue';
import { getContrastTextColor } from '@/utils/color';
import { CURRENCIES } from '@/utils/currency';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const emit = defineEmits<{ (e: 'completed'): void }>();

const step = ref<1 | 2>(1);

// A handful of ready-made primary/secondary combos so picking a palette is
// one click instead of an intimidating blank color picker — still fully
// editable afterwards from Settings → Brand.
const PALETTES = [
  { primary: '#dc2626', secondary: '#f59e0b', name: 'Warm' },
  { primary: '#0f766e', secondary: '#f59e0b', name: 'Fresh' },
  { primary: '#7c3aed', secondary: '#ec4899', name: 'Bold' },
  { primary: '#1d4ed8', secondary: '#06b6d4', name: 'Trust' },
  { primary: '#166534', secondary: '#eab308', name: 'Natural' },
  { primary: '#1f2937', secondary: '#d97706', name: 'Classic' },
];

const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

const form = reactive({
  name: '',
  logoUrl: '',
  primaryColor: PALETTES[0].primary,
  secondaryColor: PALETTES[0].secondary,
  welcomeMessage: '',
  currencyCode: 'KZT',
});
const saving = ref(false);
const isBrandValid = computed(() => form.name.trim().length > 0);

const previewOnPrimaryText = computed(() => getContrastTextColor(form.primaryColor));

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function saveBrandAndContinue() {
  if (!isBrandValid.value) return;
  saving.value = true;
  try {
    const menuToken = await getToken();
    const { menuUpsertBrandSettings } = await import('@/api/menu/brandsettings/upsert');
    await menuUpsertBrandSettings(menuToken, nsSlug.value, {
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || undefined,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      welcomeMessage: form.welcomeMessage.trim() || undefined,
      currencyCode: form.currencyCode,
    });
    step.value = 2;
  } catch (e) {
    logError('[onboarding] saveBrandAndContinue failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save brand settings', color: 'red' });
  } finally {
    saving.value = false;
  }
}

// --- Branches (optional) ---
const branchForm = reactive({ name: '', address: '', phone: '' });
const addedBranches = ref<{ name: string; address: string }[]>([]);
const branchSaving = ref(false);
const isBranchValid = computed(() => branchForm.name.trim().length > 0 && branchForm.address.trim().length > 0);

async function addBranch() {
  if (!isBranchValid.value) return;
  branchSaving.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateBranch } = await import('@/api/menu/branch/create');
    const { normalizePhoneForStorage } = await import('@/utils/phone');
    const created = await menuCreateBranch(menuToken, nsSlug.value, {
      name: branchForm.name.trim(),
      address: branchForm.address.trim(),
      phone: branchForm.phone.trim() ? normalizePhoneForStorage(branchForm.phone.trim()) : undefined,
      isPrimary: addedBranches.value.length === 0,
    } as any);
    addedBranches.value.push({ name: created.name, address: created.address });
    branchForm.name = '';
    branchForm.address = '';
    branchForm.phone = '';
  } catch (e) {
    logError('[onboarding] addBranch failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add branch', color: 'red' });
  } finally {
    branchSaving.value = false;
  }
}

function finish() {
  emit('completed');
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
    <div class="max-w-lg mx-auto px-4 py-10">
      <div class="text-center mb-6">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('menu.onboardingTitle') || "Let's set up your storefront" }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('menu.onboardingSubtitle') || 'A couple of quick steps and your shop is ready to share.' }}</p>
      </div>

      <div class="flex items-center justify-center gap-2 mb-6">
        <span class="flex items-center gap-1.5 text-xs font-medium" :class="step >= 1 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" :class="step >= 1 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'">1</span>
          {{ t('menu.onboardingStepBrand') || 'Brand' }}
        </span>
        <span class="w-8 h-0.5" :class="step >= 2 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'" />
        <span class="flex items-center gap-1.5 text-xs font-medium" :class="step >= 2 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" :class="step >= 2 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'">2</span>
          {{ t('menu.onboardingStepBranches') || 'Branches' }}
        </span>
      </div>

      <!-- Step 1: Brand -->
      <div v-if="step === 1" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <ImageUpload v-model="form.logoUrl" :ns-slug="nsSlug" aspect="square" fit="contain" />
          <div class="flex-1 min-w-0">
            <UFormGroup :label="t('menu.name') || 'Name'" required>
              <UInput v-model="form.name" size="lg" :placeholder="t('menu.onboardingNamePlaceholder') || 'Your business name'" />
            </UFormGroup>
          </div>
        </div>

        <UFormGroup :label="t('menu.welcomeMessage') || 'Welcome message'">
          <UTextarea v-model="form.welcomeMessage" :rows="2" :placeholder="t('menu.onboardingWelcomePlaceholder') || 'A short line customers see first'" />
        </UFormGroup>

        <UFormGroup :label="t('menu.currencyCode') || 'Currency'">
          <USelectMenu v-model="form.currencyCode" :options="currencyOptions" value-attribute="value" option-attribute="label" size="lg" class="max-w-[180px]" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <UFormGroup :label="t('menu.onboardingPalette') || 'Pick a color palette'">
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in PALETTES"
              :key="p.name"
              type="button"
              class="rounded-xl border-2 p-2 flex flex-col items-center gap-1.5 transition-colors"
              :class="form.primaryColor === p.primary ? 'border-primary-500' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'"
              @click="form.primaryColor = p.primary; form.secondaryColor = p.secondary"
            >
              <span class="flex -space-x-1.5">
                <span class="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-900" :style="{ backgroundColor: p.primary }" />
                <span class="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-900" :style="{ backgroundColor: p.secondary }" />
              </span>
              <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ p.name }}</span>
            </button>
          </div>
          <div class="mt-3 rounded-lg overflow-hidden" :style="{ backgroundColor: form.primaryColor }">
            <div class="px-3 py-2.5 text-sm font-semibold truncate" :style="{ color: previewOnPrimaryText }">
              {{ form.name || (t('menu.name') || 'Name') }}
            </div>
          </div>
        </UFormGroup>

        <div class="flex justify-end pt-1">
          <UButton color="primary" :loading="saving" :disabled="!isBrandValid || saving" @click="saveBrandAndContinue">
            {{ t('menu.onboardingContinue') || 'Continue' }}
          </UButton>
        </div>
      </div>

      <!-- Step 2: Branches (optional) -->
      <div v-else class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('menu.onboardingBranchesHint') || 'Add at least one branch so customers know where to find you — you can always add more later.' }}</p>

        <div v-if="addedBranches.length" class="space-y-1.5">
          <div v-for="(b, idx) in addedBranches" :key="idx" class="flex items-center gap-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
            <Icon name="lucide:check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span class="font-medium text-gray-900 dark:text-white">{{ b.name }}</span>
            <span class="text-gray-400 truncate">— {{ b.address }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <UFormGroup :label="t('menu.name') || 'Name'">
            <UInput v-model="branchForm.name" size="lg" :placeholder="t('menu.onboardingBranchNamePlaceholder') || 'e.g. Downtown'" />
          </UFormGroup>
          <UFormGroup :label="t('menu.address') || 'Address'">
            <UInput v-model="branchForm.address" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('menu.phone') || 'Phone'">
            <UInput v-model="branchForm.phone" type="tel" size="lg" />
          </UFormGroup>
          <UButton color="gray" variant="soft" icon="lucide:plus" :loading="branchSaving" :disabled="!isBranchValid || branchSaving" @click="addBranch">
            {{ t('menu.addBranch') || 'Add branch' }}
          </UButton>
        </div>

        <div class="flex justify-end pt-1">
          <UButton color="primary" @click="finish">
            {{ addedBranches.length ? (t('menu.onboardingFinish') || 'Go to my store') : (t('menu.onboardingSkip') || 'Skip for now') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
