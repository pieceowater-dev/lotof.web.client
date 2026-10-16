<script lang="ts">
export interface DesignPayload {
  themeId: string; themeVarsJson: string; logoUrl: string; footerText: string;
  faviconUrl: string; ogImageUrl: string; headHtml: string; footHtml: string; customCss: string; floatJson: string; navJson: string;
}
</script>

<script lang="ts" setup>
import SiteThemePreview from '@/components/pages/SiteThemePreview.vue';
import MenuEditor from '@/components/pages/MenuEditor.vue';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { pagesUploadMedia } from '@/api/pages/media';
import { pagesRequestWithRefresh } from '@/api/pages/pagesRequestWithRefresh';
import type { PagesSite } from '@/api/pages/ops';
import { compressImageForUpload } from '@/utils/imageCompression';
import { siteAssetUrl } from '@/utils/pagesSite';
import {
  THEME_PRESETS, BACKGROUNDS, SITE_ACCENTS, HEADING_COLORS, KNOB_GROUPS, FONT_STACKS, DEFAULT_PRESET,
  presetById, resolveVars, isDark, contrast, toneColors, type ThemeVars,
} from '@/utils/pagesThemes';

const props = defineProps<{ site: PagesSite; nsSlug: string; saving?: boolean }>();
const emit = defineEmits<{ save: [payload: DesignPayload] }>();

const { t } = useI18n();
const toast = useToast();
const { getToken } = usePagesAuth();

const presetId = ref(DEFAULT_PRESET);
const vars = reactive<ThemeVars>({ ...presetById(DEFAULT_PRESET).vars });
const media = reactive({ logoUrl: '', faviconUrl: '', ogImageUrl: '' });
const text = reactive({ footerText: '', headHtml: '', footHtml: '', customCss: '' });
const busy = ref('');

// ── site menu (edited by MenuEditor; navJson is the serialized tree) ──
const navJsonVal = ref('');

// ── floating contact buttons ──
const FLOAT_KINDS = ['call', 'whatsapp', 'telegram', 'email', 'link', 'top'] as const;
interface FloatItem { kind: string; label: string; value: string }
const float = reactive<{ position: string; style: string; items: FloatItem[] }>({ position: 'right', style: 'icons', items: [] });
function loadFloat(raw: string) {
  let o: any = {};
  try { o = JSON.parse(raw || '{}') || {}; } catch { o = {}; }
  float.position = o.position === 'left' ? 'left' : 'right';
  float.style = o.style === 'labels' ? 'labels' : 'icons';
  float.items = Array.isArray(o.items) ? o.items.slice(0, 5).map((i: any) => ({ kind: String(i.kind || 'call'), label: String(i.label || ''), value: String(i.value || '') })) : [];
}
const floatJson = () => (float.items.length ? JSON.stringify({ position: float.position, style: float.style, items: float.items }) : '');
function addFloat() { if (float.items.length < 5) float.items.push({ kind: 'call', label: '', value: '' }); }
const saved = ref('');

function load(site: PagesSite) {
  const s = site.settings;
  presetId.value = s.themeId || DEFAULT_PRESET;
  Object.assign(vars, resolveVars(presetId.value, s.themeVarsJson));
  Object.assign(media, { logoUrl: s.logoUrl || '', faviconUrl: s.faviconUrl || '', ogImageUrl: s.ogImageUrl || '' });
  Object.assign(text, { footerText: s.footerText || '', headHtml: s.headHtml || '', footHtml: s.footHtml || '', customCss: s.customCss || '' });
  loadFloat(s.floatJson);
  navJsonVal.value = s.navJson || '';
  saved.value = snapshot();
}
const snapshot = () => JSON.stringify({ p: presetId.value, v: vars, m: media, x: text, f: float, n: navJsonVal.value });
watch(() => props.site, (s) => load(s), { immediate: true });
const dirty = computed(() => snapshot() !== saved.value);

// ── presets ──
const tone = ref<'all' | 'light' | 'dark'>('all');
const showAll = ref(false);
const shownPresets = computed(() => {
  const list = THEME_PRESETS.filter(p => tone.value === 'all' || (tone.value === 'dark') === isDark(p.vars.bg));
  return showAll.value ? list : list.slice(0, 8);
});
const presetCount = computed(() => THEME_PRESETS.filter(p => tone.value === 'all' || (tone.value === 'dark') === isDark(p.vars.bg)).length);
function pickPreset(id: string) {
  presetId.value = id;
  Object.assign(vars, presetById(id).vars);
}

// ── colours ──
const bgId = computed(() => BACKGROUNDS.find(b => b.bg === vars.bg)?.id || '');
function pickBackground(id: string) {
  const b = BACKGROUNDS.find(x => x.id === id);
  if (b) { vars.bg = b.bg; vars.text = b.text; if (vars.heading && contrast(vars.heading, b.bg) < 4.5) vars.heading = ''; }
}
const headingOptions = computed(() => HEADING_COLORS.filter(c => contrast(c, vars.bg) >= 4.5));

// ── knobs ──
const open = reactive<Record<string, boolean>>({ typography: true, layout: false, header: false, content: false, footer: false, code: false });
const optLabel = (key: string, v: string) => t(`pages.design.opt.${key === 'headingFont' ? 'font' : key}.${v}`);

// ── uploads ──
const preview = (u: string) => siteAssetUrl(props.site.host, u);
async function upload(kind: 'logoUrl' | 'faviconUrl' | 'ogImageUrl', e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  busy.value = kind;
  try {
    const m = await pagesRequestWithRefresh(async () => {
      const token = await getToken(props.nsSlug);
      const prepared = await compressImageForUpload(file, { t });
      return pagesUploadMedia(token, props.nsSlug, props.site.id, prepared, props.site.name);
    }, props.nsSlug);
    media[kind] = m.url;
  } catch (err: any) {
    toast.add({ title: t('pages.editor.uploadFailed'), description: err?.message, color: 'red' });
  } finally {
    busy.value = '';
  }
}

function save() {
  emit('save', { themeId: presetId.value, themeVarsJson: JSON.stringify(vars), logoUrl: media.logoUrl, footerText: text.footerText.trim(),
    faviconUrl: media.faviconUrl, ogImageUrl: media.ogImageUrl, headHtml: text.headHtml, footHtml: text.footHtml, customCss: text.customCss, floatJson: floatJson(), navJson: navJsonVal.value });
  saved.value = snapshot();
}

const dark = computed(() => isDark(vars.bg));
const headerTone = computed(() => toneColors(vars, vars.headerTone));
const mediaCards = [
  { key: 'logoUrl' as const, label: 'logo', hint: 'logoHint', wide: true },
  { key: 'faviconUrl' as const, label: 'favicon', hint: 'faviconHint', wide: false },
  { key: 'ogImageUrl' as const, label: 'ogImage', hint: 'ogImageHint', wide: true },
];
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="flex min-w-0 flex-col gap-4">
      <!-- identity: logo, favicon, social image, footer text -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.identity') }}</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          <div v-for="c in mediaCards" :key="c.key" class="flex flex-col gap-2">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ t(`pages.design.${c.label}`) }}</div>
            <!-- the picture as it will look in its place -->
            <div class="overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
              <div v-if="c.key === 'logoUrl'" class="flex h-24 items-center justify-between gap-3 px-4" :style="{ background: headerTone.bg, color: headerTone.fg }">
                <span class="flex min-w-0 items-center gap-2">
                  <img v-if="media.logoUrl" :src="preview(media.logoUrl)" alt="" class="max-h-10 w-auto max-w-[5rem] object-contain">
                  <UIcon v-else name="lucide:image" class="h-6 w-6 opacity-40" />
                  <span class="truncate text-sm font-bold">{{ site.name }}</span>
                </span>
                <span class="flex flex-shrink-0 gap-2 opacity-60"><i class="h-1.5 w-8 rounded-full bg-current" /><i class="h-1.5 w-8 rounded-full bg-current" /><i class="hidden h-1.5 w-8 rounded-full bg-current sm:block" /></span>
              </div>
              <div v-else-if="c.key === 'faviconUrl'" class="flex h-24 flex-col justify-end bg-gray-200/70 px-3 pt-3 dark:bg-white/10">
                <div class="flex items-center gap-2 rounded-t-xl bg-white px-3 py-2 shadow-sm dark:bg-[#2a2a2a]">
                  <img v-if="media.faviconUrl" :src="preview(media.faviconUrl)" alt="" class="h-4 w-4 flex-shrink-0 object-contain">
                  <UIcon v-else name="lucide:globe" class="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span class="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-200">{{ site.name }}</span>
                  <UIcon name="lucide:x" class="h-3 w-3 flex-shrink-0 text-gray-400" />
                </div>
              </div>
              <div v-else class="p-3">
                <div class="overflow-hidden rounded-xl bg-white ring-1 ring-black/10 dark:bg-[#2a2a2a] dark:ring-white/10">
                  <div class="flex w-full items-center justify-center bg-gray-100 dark:bg-white/5" style="aspect-ratio: 1.91 / 1">
                    <img v-if="media.ogImageUrl" :src="preview(media.ogImageUrl)" alt="" class="h-full w-full object-cover">
                    <UIcon v-else name="lucide:image" class="h-6 w-6 text-gray-300" />
                  </div>
                  <div class="px-3 py-2">
                    <div class="truncate text-[10px] uppercase tracking-wide text-gray-400">{{ site.host }}</div>
                    <div class="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{{ site.name }}</div>
                  </div>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t(`pages.design.${c.hint}`) }}</p>
            <div class="flex items-center gap-2">
              <label class="at-btn cursor-pointer !px-3">
                <UIcon :name="busy === c.key ? 'lucide:loader-2' : 'lucide:upload'" class="h-4 w-4" :class="busy === c.key && 'animate-spin'" />
                {{ media[c.key] ? t('pages.editor.replaceImage') : t('pages.editor.uploadImage') }}
                <input type="file" accept="image/*" class="hidden" :disabled="!!busy" @change="upload(c.key, $event)">
              </label>
              <button v-if="media[c.key]" type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="media[c.key] = ''">{{ t('pages.editor.remove') }}</button>
            </div>
          </div>
        </div>
        <UFormGroup :label="t('pages.design.footer')" :help="t('pages.design.footerHint')">
          <UInput v-model="text.footerText" maxlength="160" :placeholder="site.name" />
        </UFormGroup>
      </section>

      <!-- site menu -->
      <MenuEditor v-model="navJsonVal" :site-id="site.id" :ns-slug="nsSlug" />

      <!-- floating contact buttons -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.float.title') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.design.float.hint') }}</p>
          </div>
          <button v-if="float.items.length < 5" type="button" class="at-btn at-btn--blue" @click="addFloat"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.design.float.add') }}</button>
        </div>
        <template v-if="float.items.length">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormGroup :label="t('pages.design.float.position')">
              <div class="at-seg !min-w-0 self-start">
                <button v-for="p in ['left', 'right']" :key="p" type="button" class="at-seg__btn" :class="float.position === p && 'at-seg__btn--on'" @click="float.position = p">{{ t(`pages.design.float.pos.${p}`) }}</button>
              </div>
            </UFormGroup>
            <UFormGroup :label="t('pages.design.float.style')">
              <div class="at-seg !min-w-0 self-start">
                <button v-for="p in ['icons', 'labels']" :key="p" type="button" class="at-seg__btn" :class="float.style === p && 'at-seg__btn--on'" @click="float.style = p">{{ t(`pages.design.float.styles.${p}`) }}</button>
              </div>
            </UFormGroup>
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="(it, i) in float.items" :key="i" class="flex flex-col gap-2 rounded-2xl bg-gray-50 p-3 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
              <div class="flex items-start justify-between gap-2">
                <div class="at-seg !min-w-0 flex-wrap">
                  <button v-for="k in FLOAT_KINDS" :key="k" type="button" class="at-seg__btn !px-3 !py-1.5 !text-xs" :class="it.kind === k && 'at-seg__btn--on'" @click="it.kind = k">{{ t(`pages.design.float.kind.${k}`) }}</button>
                </div>
                <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :aria-label="t('common.delete')" @click="float.items.splice(i, 1)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <UInput v-model="it.label" maxlength="40" :placeholder="t('pages.design.float.label')" />
                <UInput v-if="it.kind !== 'top'" v-model="it.value" :placeholder="t(`pages.design.float.value.${it.kind}`)" />
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- presets -->
      <section class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.presets') }} <span class="font-normal text-gray-400">{{ THEME_PRESETS.length }}</span></h3>
          <div class="at-seg !min-w-0">
            <button v-for="k in (['all', 'light', 'dark'] as const)" :key="k" type="button" class="at-seg__btn !py-1" :class="tone === k && 'at-seg__btn--on'" @click="tone = k">{{ t(`pages.design.tone.${k}`) }}</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <button v-for="p in shownPresets" :key="p.id" type="button" class="group text-left" :aria-pressed="presetId === p.id" @click="pickPreset(p.id)">
            <div class="rounded-xl p-0.5 transition" :class="presetId === p.id ? 'ring-2 ring-primary-500' : 'ring-1 ring-black/10 group-hover:ring-black/25 dark:ring-white/15'">
              <SiteThemePreview :vars="p.vars" :site-name="site.name" compact />
            </div>
            <div class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
              <span class="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" :style="{ background: p.vars.accent }" />
              {{ t(`pages.design.preset.${p.id}`) }}
            </div>
          </button>
        </div>
        <div v-if="presetCount > 8" class="mt-3 flex justify-center">
          <button type="button" class="at-btn at-btn--blue" @click="showAll = !showAll">
            <Icon :name="showAll ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-4 w-4" />{{ showAll ? t('pages.design.showLess') : t('pages.design.showAll', { n: presetCount }) }}
          </button>
        </div>
      </section>

      <!-- colours -->
      <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.colors') }}</h3>
        <UFormGroup :label="t('pages.design.accent')" :help="t('pages.design.accentHint')">
          <ColorSwatch v-model="vars.accent" :palette="SITE_ACCENTS" />
          <PagesBrandColor v-model="vars.accent" :bg="vars.bg" class="mt-3" />
        </UFormGroup>
        <UFormGroup :label="t('pages.design.background')" :help="t('pages.design.backgroundHint')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in BACKGROUNDS" :key="b.id" type="button"
              class="h-8 w-12 rounded-lg border-2 transition-transform hover:scale-105"
              :class="bgId === b.id ? 'border-gray-900 dark:border-white' : 'border-black/10 dark:border-white/15'"
              :style="{ background: b.bg }" :aria-label="t(`pages.design.bg.${b.id}`)" :title="t(`pages.design.bg.${b.id}`)"
              @click="pickBackground(b.id)"
            ><span class="text-[10px] font-bold" :style="{ color: b.text }">Aa</span></button>
          </div>
        </UFormGroup>
        <UFormGroup :label="t('pages.design.headingColor')" :help="t('pages.design.headingColorHint')">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="at-btn !py-1" :class="!vars.heading && 'at-btn--blue'" @click="vars.heading = ''">{{ t('pages.design.auto') }}</button>
            <button
              v-for="c in headingOptions" :key="c" type="button" class="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="vars.heading === c ? 'border-gray-900 dark:border-white' : 'border-black/10 dark:border-white/15'" :style="{ background: c }" :aria-label="c" @click="vars.heading = c"
            />
          </div>
        </UFormGroup>
      </section>

      <!-- every other option, grouped -->
      <section v-for="g in KNOB_GROUPS" :key="g.id" class="rounded-2xl bg-white ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <button type="button" class="flex w-full items-center justify-between gap-3 p-4 text-left sm:px-5" :aria-expanded="open[g.id]" @click="open[g.id] = !open[g.id]">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t(`pages.design.group.${g.id}`) }}</h3>
          <Icon name="lucide:chevron-down" class="h-4 w-4 text-gray-400 transition-transform" :class="open[g.id] && 'rotate-180'" />
        </button>
        <div v-if="open[g.id]" class="grid gap-4 px-4 pb-5 sm:grid-cols-2 sm:px-5">
          <UFormGroup v-for="k in g.knobs" :key="k.key" :label="t(`pages.design.knob.${k.key}`)" :class="k.options.length > 5 && 'sm:col-span-2'">
            <div class="at-seg !min-w-0 flex-wrap self-start" :class="k.options.length > 5 && '!rounded-3xl'">
              <button
                v-for="o in k.options" :key="o" type="button" class="at-seg__btn" :class="vars[k.key] === o && 'at-seg__btn--on'"
                :style="k.key === 'font' || k.key === 'headingFont' ? { fontFamily: FONT_STACKS[o] } : undefined" @click="vars[k.key] = o"
              >{{ optLabel(k.key, o) }}</button>
            </div>
          </UFormGroup>
        </div>
      </section>

      <!-- code: scripts + css -->
      <section class="rounded-2xl bg-white ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <button type="button" class="flex w-full items-center justify-between gap-3 p-4 text-left sm:px-5" :aria-expanded="open.code" @click="open.code = !open.code">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.code') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.design.codeHint') }}</p>
          </div>
          <Icon name="lucide:chevron-down" class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform" :class="open.code && 'rotate-180'" />
        </button>
        <div v-if="open.code" class="flex flex-col gap-4 px-4 pb-5 sm:px-5">
          <UFormGroup :label="t('pages.design.customCss')" :help="t('pages.design.customCssHint')">
            <UTextarea v-model="text.customCss" :rows="10" spellcheck="false" :ui="{ base: 'font-mono text-xs' }" placeholder=".site-header { box-shadow: 0 2px 12px rgba(0,0,0,.08); }" />
          </UFormGroup>
          <UFormGroup :label="t('pages.design.headHtml')" :help="t('pages.design.headHtmlHint')">
            <UTextarea v-model="text.headHtml" :rows="5" spellcheck="false" :ui="{ base: 'font-mono text-xs' }" placeholder="<script async src=&quot;https://www.googletagmanager.com/gtag/js?id=G-XXXX&quot;></script>" />
          </UFormGroup>
          <UFormGroup :label="t('pages.design.footHtml')" :help="t('pages.design.footHtmlHint')">
            <UTextarea v-model="text.footHtml" :rows="5" spellcheck="false" :ui="{ base: 'font-mono text-xs' }" placeholder="<script>/* chat widget */</script>" />
          </UFormGroup>
          <div class="at-notice !mb-0 text-amber-800 dark:text-amber-200" style="background: rgba(245, 158, 11, 0.1); box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.25)">{{ t('pages.design.codeWarn') }}</div>
        </div>
      </section>

      <div class="hdr-shell sticky bottom-3 z-10 flex items-center justify-between gap-3 px-4 py-2">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ dirty ? t('pages.design.unsaved') : t('pages.settings.needsPublish') }}</p>
        <button type="button" class="at-btn at-btn--primary" :disabled="saving || !dirty" @click="save">
          <UIcon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
        </button>
      </div>
    </div>

    <!-- live preview -->
    <aside class="lg:sticky lg:top-4 lg:self-start">
      <div class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
        {{ t('pages.design.preview') }}<span v-if="dark" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] normal-case text-gray-500 dark:bg-white/10">{{ t('pages.design.dark') }}</span>
      </div>
      <SiteThemePreview :vars="vars" :site-name="site.name" :logo="preview(media.logoUrl)" :footer="text.footerText" />
    </aside>
  </div>
</template>
