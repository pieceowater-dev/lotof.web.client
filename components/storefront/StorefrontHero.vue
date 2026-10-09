<template>
  <div class="sf-hero">
    <div class="sf-hero__inner">
      <button v-if="backLabel" type="button" class="sf-back" @click="emit('back')">
        <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />
        {{ backLabel }}
      </button>

      <div class="flex items-start gap-4">
        <div class="sf-logo" :class="compact ? 'sf-logo--sm' : ''">
          <img v-if="logoUrl" :src="logoUrl" :alt="logoAlt || name" class="h-full w-full object-contain p-1.5">
          <UIcon v-else :name="fallbackIcon" class="h-8 w-8 text-gray-300" />
        </div>
        <div class="min-w-0 flex-1 pt-1">
          <h1 class="truncate font-extrabold leading-tight tracking-tight" :class="compact ? 'text-xl' : 'text-2xl sm:text-3xl'">{{ name }}</h1>
          <p
            v-if="description"
            class="mt-1 text-sm leading-6"
            :class="expanded ? '' : 'line-clamp-2'"
            style="opacity: 0.88; cursor: pointer"
            role="button"
            tabindex="0"
            @click="expanded = !expanded"
            @keydown.enter="expanded = !expanded"
          >{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex-shrink-0"><slot name="actions" /></div>
      </div>

      <div v-if="$slots.chips" class="mt-4 flex flex-wrap items-center gap-2">
        <slot name="chips" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
  fallbackIcon?: string;
  backLabel?: string | null;
  compact?: boolean;
}>(), { description: null, logoUrl: null, logoAlt: null, fallbackIcon: 'lucide:store', backLabel: null, compact: false });

const emit = defineEmits<{ (e: 'back'): void }>();
const expanded = ref(false);
</script>
