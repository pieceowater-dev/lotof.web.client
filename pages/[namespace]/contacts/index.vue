<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

const route = useRoute();

const nsSlug = route.params.namespace as string;

await navigateTo(`/${nsSlug}/contacts/all/1-20`, { replace: true });
</script>

<template>
  <div class="min-h-screen px-4 pt-6">
    <AppSkeleton variant="table" :rows="8" :cols="6" />
  </div>
</template>
