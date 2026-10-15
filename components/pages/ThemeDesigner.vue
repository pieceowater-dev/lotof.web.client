<script lang="ts" setup>
import SiteThemePreview from '@/components/pages/SiteThemePreview.vue';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { pagesUploadMedia } from '@/api/pages/media';
import { pagesRequestWithRefresh } from '@/api/pages/pagesRequestWithRefresh';
import type { PagesSite } from '@/api/pages/ops';
import { compressImageForUpload } from '@/utils/imageCompression';
import { siteAssetUrl } from '@/utils/pagesSite';
import {
  THEME_PRESETS, BACKGROUNDS, SITE_ACCENTS, FONTS, RADII, WIDTHS, HEADERS, DEFAULT_PRESET,
  presetById, resolveVars, type ThemeVars,
} from '@/utils/pagesThemes';

const props = defineProps<{ site: PagesSite; nsSlug: string; saving?: boolean }>();
const emit = defineEmits<{ save: [payload: { themeId: string; themeVarsJson: string; logoUrl: string; footerText: string }] }>();

const { t } = useI18n();
const toast = useToast();
const { getToken } = usePagesAuth();

const presetId = ref(DEFAULT_PRESET);
const vars = reactive<ThemeVars>({ ...presetById(DEFAULT_PRESET).vars });
const logoUrl = ref('');
const footerText = ref('');
const logoBusy = ref(false);
const saved = ref('');

function load(site: PagesSite) {
  presetId.value = site.settings.themeId || DEFAULT_PRESET;
  Object.assign(vars, resolveVars(presetId.value, site.settings.themeVarsJson));
  logoUrl.value = site.settings.logoUrl || '';
  footerText.value = site.settings.footerText || '';
  saved.value = snapshot();
}
const snapshot = () => JSON.stringify({ p: presetId.value, v: vars, l: logoUrl.value, f: footerText.value });
watch(() => props.site, (s) => load(s), { immediate: true });
const dirty = computed(() => snapshot() !== saved.value);

function pickPreset(id: string) {
  presetId.value = id;
  Object.assign(vars, presetById(id).vars);
}

const bgId = computed(() => BACKGROUNDS.find(b => b.bg === vars.bg)?.id || '');
function pickBackground(id: string) {
  const b = BACKGROUNDS.find(x => x.id === id);
  if (b) { vars.bg = b.bg; vars.text = b.text; }
}

const logoPreview = computed(() => siteAssetUrl(props.site.host, logoUrl.value));
async function onLogo(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  logoBusy.value = true;
  try {
    const media = await pagesRequestWithRefresh(async () => {
      const token = await getToken(props.nsSlug);
      const prepared = await compressImageForUpload(file, { t });
      return pagesUploadMedia(token, props.nsSlug, props.site.id, prepared, props.site.name);
    }, props.nsSlug);
    logoUrl.value = media.url;
  } catch (err: any) {
    toast.add({ title: t('pages.editor.uploadFailed'), description: err?.message, color: 'red' });
  } finally {
    logoBusy.value = false;
  }
}

function save() {
  emit('save', { themeId: presetId.value, themeVarsJson: JSON.stringify(vars), logoUrl: logoUrl.value, footerText: footerText.value.trim() });
  saved.value = snapshot();
}

const dark = computed(() => vars.text > vars.bg);
function seg<T extends string>(key: 'font' | 'headingFont' | 'radius' | 'width' | 'header', value: T) {
  (vars as any)[key] = value;
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="flex min-w-0 flex-col gap-4">
      <!-- presets -->
      <section class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.presets') }}</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <button
            v-for="p in THEME_PRESETS" :key="p.id" type="button" class="group text-left"
            :aria-pressed="presetId === p.id" @click="pickPreset(p.id)"
          >
            <div class="rounded-xl p-0.5 transition" :class="presetId === p.id ? 'ring-2 ring-primary-500' : 'ring-1 ring-black/10 group-hover:ring-black/25 dark:ring-white/15'">
              <SiteThemePreview :vars="p.vars" :site-name="site.name" compact />
            </div>
            <div class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
              <span class="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" :style="{ background: p.vars.accent }" />
              {{ t(`pages.design.preset.${p.id}`) }}
            </div>
          </button>
        </div>
      </section>

      <!-- colours -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.colors') }}</h3>
        <UFormGroup :label="t('pages.design.accent')" :help="t('pages.design.accentHint')">
          <ColorSwatch v-model="vars.accent" :palette="SITE_ACCENTS" />
        </UFormGroup>
        <UFormGroup :label="t('pages.design.background')" :help="t('pages.design.backgroundHint')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in BACKGROUNDS" :key="b.id" type="button"
              class="h-8 w-12 rounded-lg border-2 transition-transform hover:scale-105"
              :class="bgId === b.id ? 'border-gray-900 dark:border-white' : 'border-black/10 dark:border-white/15'"
              :style="{ background: b.bg }" :aria-label="t(`pages.design.bg.${b.id}`)" :title="t(`pages.design.bg.${b.id}`)"
              @click="pickBackground(b.id)"
            >
              <span class="text-[10px] font-bold" :style="{ color: b.text }">Aa</span>
            </button>
          </div>
        </UFormGroup>
      </section>

      <!-- typography + shape -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.typography') }}</h3>
        <UFormGroup :label="t('pages.design.bodyFont')">
          <div class="at-seg !min-w-0 flex-wrap self-start">
            <button v-for="f in FONTS" :key="f" type="button" class="at-seg__btn" :class="vars.font === f && 'at-seg__btn--on'" @click="seg('font', f)">{{ t(`pages.design.font.${f}`) }}</button>
          </div>
        </UFormGroup>
        <UFormGroup :label="t('pages.design.headingFont')">
          <div class="at-seg !min-w-0 flex-wrap self-start">
            <button v-for="f in FONTS" :key="f" type="button" class="at-seg__btn" :class="vars.headingFont === f && 'at-seg__btn--on'" @click="seg('headingFont', f)">{{ t(`pages.design.font.${f}`) }}</button>
          </div>
        </UFormGroup>
        <h3 class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.layout') }}</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormGroup :label="t('pages.design.radius')">
            <div class="at-seg !min-w-0 self-start">
              <button v-for="r in RADII" :key="r" type="button" class="at-seg__btn" :class="vars.radius === r && 'at-seg__btn--on'" @click="seg('radius', r)">{{ t(`pages.design.radiusOpt.${r}`) }}</button>
            </div>
          </UFormGroup>
          <UFormGroup :label="t('pages.design.width')">
            <div class="at-seg !min-w-0 self-start">
              <button v-for="w in WIDTHS" :key="w" type="button" class="at-seg__btn" :class="vars.width === w && 'at-seg__btn--on'" @click="seg('width', w)">{{ t(`pages.design.widthOpt.${w}`) }}</button>
            </div>
          </UFormGroup>
          <UFormGroup :label="t('pages.design.header')">
            <div class="at-seg !min-w-0 self-start">
              <button v-for="h in HEADERS" :key="h" type="button" class="at-seg__btn" :class="vars.header === h && 'at-seg__btn--on'" @click="seg('header', h)">{{ t(`pages.design.headerOpt.${h}`) }}</button>
            </div>
          </UFormGroup>
        </div>
      </section>

      <!-- identity -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.identity') }}</h3>
        <UFormGroup :label="t('pages.design.logo')" :help="t('pages.design.logoHint')">
          <div class="flex items-center gap-3">
            <div class="flex h-12 min-w-12 items-center justify-center overflow-hidden rounded-xl bg-gray-50 px-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
              <img v-if="logoUrl" :src="logoPreview" alt="" class="max-h-10 w-auto">
              <UIcon v-else name="lucide:image" class="h-5 w-5 text-gray-300" />
            </div>
            <label class="at-btn cursor-pointer">
              <UIcon :name="logoBusy ? 'lucide:loader-2' : 'lucide:upload'" class="h-4 w-4" :class="logoBusy && 'animate-spin'" />
              {{ logoUrl ? t('pages.editor.replaceImage') : t('pages.editor.uploadImage') }}
              <input type="file" accept="image/*" class="hidden" :disabled="logoBusy" @change="onLogo">
            </label>
            <button v-if="logoUrl" type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="logoUrl = ''">{{ t('pages.editor.remove') }}</button>
          </div>
        </UFormGroup>
        <UFormGroup :label="t('pages.design.footer')" :help="t('pages.design.footerHint')">
          <UInput v-model="footerText" maxlength="160" :placeholder="site.name" />
        </UFormGroup>
      </section>

      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('pages.settings.needsPublish') }}</p>
        <button type="button" class="at-btn at-btn--primary" :disabled="saving || !dirty" @click="save">
          <UIcon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
        </button>
      </div>
    </div>

    <!-- live preview -->
    <aside class="lg:sticky lg:top-24 lg:self-start">
      <div class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
        {{ t('pages.design.preview') }}<span v-if="dark" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] normal-case text-gray-500 dark:bg-white/10">{{ t('pages.design.dark') }}</span>
      </div>
      <SiteThemePreview :vars="vars" :site-name="site.name" :logo="logoPreview" :footer="footerText" />
    </aside>
  </div>
</template>
