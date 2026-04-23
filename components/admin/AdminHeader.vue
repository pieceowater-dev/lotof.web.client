<template>
  <div class="border-b border-slate-200 dark:border-slate-800">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Back button -->
          <NuxtLink
            to="/console"
            class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="lucide:arrow-left" class="h-5 w-5" />
          </NuxtLink>

          <!-- Breadcrumb / Title -->
          <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
              {{ title }}
            </h1>
            <p v-if="description" class="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {{ description }}
            </p>
          </div>
        </div>

        <!-- Action slot -->
        <div class="flex gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

defineProps<Props>();
</script>

