<script lang="ts" setup>
// Miniature of a published page, driven by the same variables the real stylesheet uses.
import { FONT_STACKS, onAccent, radiusPx, toneColors, type ThemeVars } from '@/utils/pagesThemes';

const props = defineProps<{ vars: ThemeVars; siteName: string; logo?: string; footer?: string; compact?: boolean }>();

const header = computed(() => toneColors(props.vars, props.vars.headerTone));
const foot = computed(() => toneColors(props.vars, props.vars.footerTone));
const heading = computed(() => props.vars.heading || props.vars.text);

const style = computed(() => {
  const v = props.vars;
  const r = radiusPx(v.radius);
  const shadow = { none: 'none', soft: '0 1px 2px rgba(0,0,0,.06),0 6px 18px -6px rgba(0,0,0,.12)', lifted: '0 14px 34px -10px rgba(0,0,0,.3)' }[v.shadow] || 'none';
  const bgImage = {
    dots: `radial-gradient(color-mix(in srgb, ${v.text} 14%, transparent) 1px, transparent 1px)`,
    grid: `linear-gradient(color-mix(in srgb, ${v.text} 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${v.text} 7%, transparent) 1px, transparent 1px)`,
    glow: `radial-gradient(60% 40% at 50% -10%, color-mix(in srgb, ${v.accent} 18%, transparent), transparent)`,
  }[v.bgStyle];
  return {
    '--accent': v.accent, '--on-accent': onAccent(v.accent), '--bg': v.bg, '--text': v.text,
    '--r': r.card, '--rb': r.btn, '--sh': shadow,
    '--muted': `color-mix(in srgb, ${v.text} 62%, ${v.bg})`,
    '--line': `color-mix(in srgb, ${v.text} 14%, ${v.bg})`,
    '--accent-soft': `color-mix(in srgb, ${v.accent} 11%, ${v.bg})`,
    '--hfont': FONT_STACKS[v.headingFont],
    background: v.bg, backgroundImage: bgImage, backgroundSize: v.bgStyle === 'dots' ? '9px 9px' : v.bgStyle === 'grid' ? '16px 16px' : undefined,
    color: v.text, fontFamily: FONT_STACKS[v.font],
  } as Record<string, string | undefined>;
});

const maxW = computed(() => ({ narrow: '58%', normal: '70%', wide: '86%', xl: '96%' }[props.vars.width] || '70%'));
const titleSize = computed(() => ({ md: '1rem', lg: '1.25rem', xl: '1.5rem' }[props.vars.titleSize] || '1rem'));
const bodySize = computed(() => ({ sm: '10.5px', md: '11px', lg: '12.5px' }[props.vars.fontSize] || '11px'));
const gap = computed(() => ({ compact: '.35rem', normal: '.6rem', airy: '.9rem' }[props.vars.spacing] || '.6rem'));
const weight = computed(() => ({ medium: 500, bold: 700, black: 800 }[props.vars.headingWeight] || 700));
const logoH = computed(() => ({ sm: '.9rem', md: '1.1rem', lg: '1.7rem' }[props.vars.logoSize] || '1.1rem'));
const showName = computed(() => !(props.logo && props.vars.showName === 'no'));
const pill = computed(() => props.vars.header === 'pill');
const navLink = (i: number) => {
  const v = props.vars;
  const on = i === 0;
  const base: Record<string, string> = { color: on ? (v.headerTone === 'accent' || v.headerTone === 'dark' ? header.value.fg : v.accent) : header.value.fg, opacity: on ? '1' : '.78' };
  if (v.nav === 'underline' && on) base.borderBottom = '2px solid currentColor';
  if (v.nav === 'pills') { base.padding = '1px 7px'; base.borderRadius = '999px'; if (on) base.background = 'color-mix(in srgb, currentColor 16%, transparent)'; }
  return base;
};
</script>

<template>
  <div class="overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/15" :style="style">
    <div :style="{ background: pill ? 'transparent' : header.bg, color: header.fg, borderBottom: vars.header === 'minimal' || pill ? 'none' : `1px solid color-mix(in srgb, ${header.fg} 16%, ${header.bg})`, padding: pill ? '6px 8px 0' : vars.header === 'minimal' ? '14px 12px 8px' : '8px 12px' }">
      <div
        class="flex gap-2 text-[10px]" :class="vars.header === 'center' ? 'flex-col items-center' : 'items-center justify-between'"
        :style="pill ? { background: header.bg, borderRadius: '999px', padding: '5px 12px', boxShadow: 'var(--sh)', border: `1px solid color-mix(in srgb, ${header.fg} 16%, ${header.bg})` } : undefined"
      >
        <span class="flex items-center gap-1.5 font-bold" :style="{ fontFamily: 'var(--hfont)', color: header.fg }">
          <img v-if="logo" :src="logo" alt="" :style="{ height: logoH, width: 'auto', borderRadius: 'calc(var(--r) / 3)' }">
          <span v-if="showName">{{ siteName || '…' }}</span>
        </span>
        <span class="flex gap-2">
          <span :style="navLink(0)">Главная</span><span :style="navLink(1)">Меню</span><span :style="navLink(2)">Контакты</span>
        </span>
      </div>
    </div>
    <div class="mx-auto py-4" :style="{ maxWidth: maxW, fontSize: bodySize, lineHeight: vars.leading === 'tight' ? 1.45 : vars.leading === 'airy' ? 1.85 : 1.65 }">
      <div
        class="leading-tight" :style="{ fontFamily: 'var(--hfont)', fontSize: titleSize, fontWeight: weight, color: heading, textAlign: vars.headingAlign === 'center' ? 'center' : 'left', textTransform: vars.headingCase === 'upper' ? 'uppercase' : 'none', letterSpacing: vars.headingCase === 'upper' ? '.04em' : undefined }"
      >Заголовок страницы</div>
      <div
        v-if="!compact" class="mt-2 text-[12px]"
        :style="{ fontFamily: 'var(--hfont)', fontWeight: weight, color: heading, textAlign: vars.headingAlign === 'center' ? 'center' : 'left', textTransform: vars.headingCase === 'upper' ? 'uppercase' : 'none', paddingBottom: vars.headingDecor === 'underline' ? '3px' : undefined, borderBottom: vars.headingDecor === 'underline' ? '2px solid var(--accent)' : undefined, borderLeft: vars.headingDecor === 'bar' ? '4px solid var(--accent)' : undefined, paddingLeft: vars.headingDecor === 'bar' ? '6px' : undefined }"
      >Подзаголовок</div>
      <p :style="{ marginTop: gap }">
        Так будет выглядеть текст на вашем сайте.
        <span :style="{ color: 'var(--accent)', textDecoration: vars.links === 'underline' ? 'underline' : 'none', fontWeight: vars.links === 'plain' ? 600 : undefined }">Ссылка</span> и абзацы.
      </p>
      <div class="flex items-center gap-2" :style="{ marginTop: gap }">
        <span class="inline-block px-3 py-1 text-[10px] font-semibold" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 'var(--rb)' }">Кнопка</span>
        <span class="inline-block border px-3 py-1 text-[10px] font-semibold" :style="{ borderColor: 'var(--accent)', color: 'var(--accent)', borderRadius: 'var(--rb)' }">Ещё</span>
      </div>
      <template v-if="!compact">
        <div
          class="mt-2.5 text-[10px]"
          :style="{ position: 'relative', margin: `${gap} 0`, padding: vars.quote === 'mark' ? '2px 0 2px 22px' : '2px 0 2px 8px', borderLeft: vars.quote === 'bar' ? '3px solid var(--accent)' : 'none', color: 'var(--muted)', fontStyle: 'italic' }"
        ><span v-if="vars.quote === 'mark'" :style="{ position: 'absolute', left: 0, top: '-6px', fontSize: '26px', color: 'var(--accent)', fontFamily: 'Georgia, serif', fontStyle: 'normal' }">“</span>Цитата в стиле темы</div>
        <div class="border p-2 text-[10px]" :style="{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--bg))', borderRadius: 'var(--r)', boxShadow: 'var(--sh)' }">
          Заметка: блок уведомления в цвете темы.
        </div>
        <div class="mt-2.5 h-10 w-full" :style="{ background: 'color-mix(in srgb, var(--text) 8%, var(--bg))', borderRadius: 'var(--r)', boxShadow: vars.images === 'shadow' ? '0 12px 32px -12px rgba(0,0,0,.4)' : undefined, border: vars.images === 'border' ? '1px solid var(--line)' : undefined }" />
      </template>
    </div>
    <div class="px-3 py-1.5 text-[9px]" :style="{ background: foot.bg, color: foot.fg, borderTop: `1px solid color-mix(in srgb, ${foot.fg} 16%, ${foot.bg})`, textAlign: vars.footerAlign === 'center' ? 'center' : 'left' }">{{ props.footer || siteName }}</div>
  </div>
</template>
