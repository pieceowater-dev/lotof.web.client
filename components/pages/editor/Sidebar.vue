<template>
  <aside class="hidden w-72 flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white md:flex xl:w-[300px] dark:border-slate-800 dark:bg-slate-900">
    <PagesEditorSidebarPanel v-bind="($attrs as any)" />
  </aside>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
