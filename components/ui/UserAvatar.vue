<template>
  <span
    class="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold uppercase"
    :class="[sizeClasses, palette.bg, palette.text]"
  >
    {{ initials }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getInitials, getAvatarPalette } from '@/utils/avatar';

// Colored initials avatar used wherever a person has no photo (friends, team
// members, staff lists, order customers, task assignees). Consolidates what
// used to be five+ copies of the same inline markup, some plain-gray, some
// already using getAvatarPalette by hand.
const props = withDefaults(defineProps<{
  name?: string | null;
  // Seed for the color palette when it should differ from the displayed
  // name (e.g. color by email so the same person keeps the same color even
  // if their display name changes) -- defaults to `name`.
  seed?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}>(), { size: 'md' });

const initials = computed(() => getInitials(props.name));
const palette = computed(() => getAvatarPalette(props.seed ?? props.name));

const SIZE_CLASSES: Record<string, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const sizeClasses = computed(() => SIZE_CLASSES[props.size]);
</script>
