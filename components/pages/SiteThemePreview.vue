<script lang="ts" setup>
// Miniature of a published page, driven by the same variables the real stylesheet uses.
import { FONT_STACKS, onAccent, radiusPx, type ThemeVars } from '@/utils/pagesThemes';

const props = defineProps<{ vars: ThemeVars; siteName: string; logo?: string; footer?: string; compact?: boolean }>();

const style = computed(() => {
  const v = props.vars;
  const r = radiusPx(v.radius);
  return {
    '--accent': v.accent, '--on-accent': onAccent(v.accent), '--bg': v.bg, '--text': v.text,
    '--r': r.card, '--rb': r.btn,
    '--muted': `color-mix(in srgb, ${v.text} 62%, ${v.bg})`,
    '--line': `color-mix(in srgb, ${v.text} 14%, ${v.bg})`,
    '--accent-soft': `color-mix(in srgb, ${v.accent} 11%, ${v.bg})`,
    '--font': FONT_STACKS[v.font], '--hfont': FONT_STACKS[v.headingFont],
    background: v.bg, color: v.text, fontFamily: FONT_STACKS[v.font],
  } as Record<string, string>;
});
const maxW = computed(() => ({ narrow: '60%', normal: '72%', wide: '90%' }[props.vars.width]));
</script>

<template>
  <div class="overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/15" :style="style">
    <div class="border-b px-3 py-2" :style="{ borderColor: 'var(--line)' }">
      <div class="flex gap-2 text-[10px]" :class="vars.header === 'center' ? 'flex-col items-center' : 'items-center justify-between'">
        <span class="flex items-center gap-1.5 font-bold" :style="{ fontFamily: 'var(--hfont)' }">
          <img v-if="logo" :src="logo" alt="" class="h-4 w-auto" :style="{ borderRadius: 'calc(var(--r) / 3)' }">
          {{ siteName || '…' }}
        </span>
        <span class="flex gap-2" :style="{ color: 'var(--muted)' }">
          <span :style="{ color: 'var(--accent)' }">Главная</span><span>Меню</span><span>Контакты</span>
        </span>
      </div>
    </div>
    <div class="mx-auto py-4" :style="{ maxWidth: maxW }">
      <div class="text-base font-bold leading-tight" :style="{ fontFamily: 'var(--hfont)' }">Заголовок страницы</div>
      <p class="mt-1.5 text-[11px] leading-relaxed" :style="{ color: 'var(--text)' }">
        Так будет выглядеть текст на вашем сайте. <span :style="{ color: 'var(--accent)', textDecoration: 'underline' }">Ссылка</span> и абзацы.
      </p>
      <div class="mt-2.5 flex items-center gap-2">
        <span class="inline-block px-3 py-1 text-[10px] font-semibold" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 'var(--rb)' }">Кнопка</span>
        <span class="inline-block border px-3 py-1 text-[10px] font-semibold" :style="{ borderColor: 'var(--accent)', color: 'var(--accent)', borderRadius: 'var(--rb)' }">Ещё</span>
      </div>
      <div v-if="!compact" class="mt-2.5 border p-2 text-[10px]" :style="{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--bg))', borderRadius: 'var(--r)' }">
        Заметка: блок уведомления в цвете темы.
      </div>
      <div v-if="!compact" class="mt-2.5 h-10 w-full" :style="{ background: 'color-mix(in srgb, var(--text) 8%, var(--bg))', borderRadius: 'var(--r)' }" />
    </div>
    <div class="border-t px-3 py-1.5 text-[9px]" :style="{ borderColor: 'var(--line)', color: 'var(--muted)' }">{{ footer || siteName }}</div>
  </div>
</template>
