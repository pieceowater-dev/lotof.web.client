<script lang="ts" setup>
// Shared header for A-Trace settings sections: title + hint on the left, actions (slot) on the right.
defineProps<{ title: string; hint?: string }>();
</script>

<template>
  <div class="at-sechead">
    <div class="min-w-0">
      <h2 class="at-h2">
        {{ title }}
      </h2>
      <p
        v-if="hint"
        class="at-hint"
      >
        {{ hint }}
      </p>
    </div>
    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
