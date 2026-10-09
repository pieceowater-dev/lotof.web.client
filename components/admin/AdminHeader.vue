<template>
  <div class="cn-head">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-4">
          <NuxtLink
            to="/console"
            class="hdr-icon-btn flex-shrink-0"
            aria-label="Back"
          >
            <Icon
              name="lucide:arrow-left"
              class="h-[18px] w-[18px]"
            />
          </NuxtLink>
          <div class="min-w-0">
            <h1 class="at-title !text-2xl truncate">
              {{ title }}
            </h1>
            <p
              v-if="description"
              class="at-sub"
            >
              {{ description }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
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

