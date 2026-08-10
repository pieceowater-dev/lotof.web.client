<template>
  <footer class="w-full flex flex-col items-center gap-2 py-3">
    <nav class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
      <NuxtLink to="/atrace" class="hover:text-gray-700 dark:hover:text-gray-300">A-Trace</NuxtLink>
      <NuxtLink to="/issues" class="hover:text-gray-700 dark:hover:text-gray-300">Issues</NuxtLink>
      <NuxtLink to="/contacts" class="hover:text-gray-700 dark:hover:text-gray-300">Contacts</NuxtLink>
      <NuxtLink to="/menu" class="hover:text-gray-700 dark:hover:text-gray-300">Orders</NuxtLink>
      <NuxtLink to="/guide" class="hover:text-gray-700 dark:hover:text-gray-300">{{ t('guide.title') }}</NuxtLink>
    </nav>
    <div class="flex items-center gap-1">
      <UTooltip text="Instagram">
        <UButton
          to="https://www.instagram.com/lota_tools"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          color="gray"
          size="xs"
          square
          aria-label="Instagram"
        >
          <UIcon name="simple-icons:instagram" class="w-3.5 h-3.5" />
        </UButton>
      </UTooltip>
      <UTooltip text="Threads">
        <UButton
          to="https://www.threads.com/@lota_tools"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          color="gray"
          size="xs"
          square
          aria-label="Threads"
        >
          <UIcon name="simple-icons:threads" class="w-3.5 h-3.5" />
        </UButton>
      </UTooltip>
      <UTooltip text="X">
        <UButton
          to="https://x.com/lota_tools"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          color="gray"
          size="xs"
          square
          aria-label="X"
        >
          <UIcon name="simple-icons:x" class="w-3.5 h-3.5" />
        </UButton>
      </UTooltip>
    </div>
    <span class="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-full">
      © {{ new Date().getFullYear() }} lota — @pieceowater
    </span>
  </footer>
</template>

<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
</script>