<template>
  <aside class="hidden w-72 flex-shrink-0 py-3 pl-1 pr-3 md:block xl:w-[316px]">
    <div class="pe-side">
      <PagesEditorSidebarPanel v-bind="($attrs as any)" />
    </div>
  </aside>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
