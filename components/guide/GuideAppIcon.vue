<template>
  <span class="guide-app-icon" :class="`guide-app-icon--${size}`" :style="style" aria-hidden="true">
    <UIcon :name="icon" class="guide-app-icon__glyph" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { guideGradientStyle } from '@/composables/useGuideApps';

const props = withDefaults(defineProps<{
  icon: string;
  gradient: [string, string];
  size?: 'sm' | 'md' | 'lg';
}>(), { size: 'md' });

const style = computed(() => ({
  ...guideGradientStyle(props.gradient),
  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.35), 0 10px 20px -10px ${props.gradient[1]}`,
}));
</script>

<style scoped>
.guide-app-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 22.4%;
  color: #fff;
}
.guide-app-icon--sm { height: 2rem; width: 2rem; }
.guide-app-icon--md { height: 3rem; width: 3rem; }
.guide-app-icon--lg { height: 4.5rem; width: 4.5rem; }
.guide-app-icon--sm .guide-app-icon__glyph { height: 1rem; width: 1rem; }
.guide-app-icon--md .guide-app-icon__glyph { height: 1.4rem; width: 1.4rem; }
.guide-app-icon--lg .guide-app-icon__glyph { height: 2.2rem; width: 2.2rem; }
</style>
