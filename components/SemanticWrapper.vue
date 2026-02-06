<!-- 
  Semantic HTML wrapper for better accessibility
  This component adds proper semantic structure
-->
<template>
  <div>
    <!-- Skip link anchor -->
    <a id="skip-to-content" class="sr-only" href="#main-content">
      Перейти к основному содержимому
    </a>

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

/* Skip link becomes visible on focus */
#skip-to-content:focus {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100000;
  width: auto;
  height: auto;
  padding: 1rem 2rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
  background: #000;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}
</style>
