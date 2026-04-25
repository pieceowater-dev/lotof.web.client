<!-- 
  Semantic HTML wrapper for better accessibility
  This component adds proper semantic structure
-->
<template>
  <div>
    <!-- Main content wrapper with proper ARIA -->
    <main 
      id="main-content" 
      role="main"
      :aria-label="ariaLabel || 'Основное содержимое'"
    >
      <slot />
    </main>

    <!-- Screen reader announcer -->
    <div 
      id="sr-announcer" 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
      class="sr-only"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  ariaLabel?: string
}>()
</script>

<style scoped>
/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
