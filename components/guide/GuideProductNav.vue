<template>
  <nav ref="navEl" class="guide-nav" :aria-label="t('guide.browseTitle')">
    <NuxtLink to="/guide" class="guide-nav__all">
      <UIcon name="lucide:layout-grid" class="h-4 w-4" />
      <span>{{ t('guide.allProducts') }}</span>
    </NuxtLink>
    <NuxtLink
      v-for="e in entries"
      :key="e.param"
      :to="`/guide/${e.param}`"
      class="guide-nav__item"
      :class="e.param === current ? 'guide-nav__item--active' : ''"
      :aria-current="e.param === current ? 'page' : undefined"
    >
      <GuideAppIcon :icon="e.icon" :gradient="e.gradient" size="sm" />
      <span class="truncate">{{ e.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useGuideApps } from '@/composables/useGuideApps';

defineProps<{ current: string }>();
const { t } = useI18n();
const { entries } = useGuideApps();

// On phones the chip row scrolls sideways: bring the active product into view.
const navEl = ref<HTMLElement | null>(null);
onMounted(() => {
  const nav = navEl.value;
  const active = nav?.querySelector<HTMLElement>('[aria-current]');
  if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
});
</script>

<style scoped>
/* Phones: a swipeable chip row. Desktop: a sticky vertical list. */
.guide-nav { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.25rem 0.1rem 0.5rem; scrollbar-width: none; }
.guide-nav::-webkit-scrollbar { display: none; }
@media (min-width: 1024px) {
  .guide-nav { flex-direction: column; gap: 0.25rem; overflow: visible; padding: 0; }
}
.guide-nav__all,
.guide-nav__item {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.6rem;
  border-radius: 9999px;
  padding: 0.4rem 0.9rem 0.4rem 0.45rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), background 0.4s cubic-bezier(0.32, 0.72, 0, 1), color 0.4s;
}
.guide-nav__all { padding-left: 0.9rem; color: #64748b; }
@media (min-width: 1024px) {
  .guide-nav__all, .guide-nav__item { border-radius: 1rem; background: transparent; box-shadow: none; }
  .guide-nav__all { margin-bottom: 0.4rem; }
}
.guide-nav__all:hover, .guide-nav__item:hover { background: rgba(15, 23, 42, 0.07); }
.guide-nav__item:active { transform: scale(0.97); }
.guide-nav__item--active { color: #0f172a; background: #fff; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08), 0 8px 20px -12px rgba(15, 23, 42, 0.3); }
.dark .guide-nav__all, .dark .guide-nav__item { color: #e5e5e5; background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
.dark .guide-nav__all { color: #a3a3a3; }
@media (min-width: 1024px) {
  .dark .guide-nav__all, .dark .guide-nav__item { background: transparent; box-shadow: none; }
}
.dark .guide-nav__all:hover, .dark .guide-nav__item:hover { background: rgba(255, 255, 255, 0.07); }
.dark .guide-nav__item--active { color: #fff; background: rgba(255, 255, 255, 0.1); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); }
</style>
