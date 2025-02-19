<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useColorMode } from '#imports';

const router = useRouter();
const route = useRoute();
const colorMode = useColorMode();

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark';
};

const goHome = () => {
  router.push('/');
};

const showMenuButton = computed(() => route.path !== '/');
</script>

<template>
  <header
    class="fixed top-0 left-0 w-full flex items-center justify-between p-2 px-4 bg-white dark:bg-gray-800 shadow-md z-50">
    
    <div class="flex items-center space-x-2 cursor-pointer" @click="goHome">
      <img src="/assets/logo.png" alt="Logo" class="h-5 w-5" />
      <span class="text-lg">lota</span>
    </div>

    <!-- <Navigation /> -->

    <div class="flex items-center">
      <UButton v-if="showMenuButton" @click="goHome" variant="ghost" size="xl">
        <UIcon name="i-lucide-house" />
      </UButton>
      <UButton @click="toggleTheme" variant="ghost" size="xl">
        <UIcon name="i-heroicons-moon" v-if="colorMode.preference === 'light'" />
        <UIcon name="i-heroicons-sun" v-else />
      </UButton>
    </div>
  </header>
</template>