<script setup>
import { useColorMode } from '#imports';

const colorMode = useColorMode();
const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark';
};
</script>

<template>
  <header class="fixed top-0 left-0 w-full flex items-center justify-between p-2 px-4 bg-white dark:bg-gray-800 shadow-md z-50">
    <h1 class="text-lg font-bold">lota</h1>
    <UButton @click="toggleTheme" variant="ghost" size="xl">
      <UIcon name="i-heroicons-moon" v-if="colorMode.preference === 'light'" />
      <UIcon name="i-heroicons-sun" v-else />
    </UButton>
  </header>
</template>
