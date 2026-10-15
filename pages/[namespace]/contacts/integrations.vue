<script lang="ts" setup>
import { usePageTitle } from '@/composables/usePageTitle';
usePageTitle('contacts', { section: 'integrations' });
// Integrations live in Contacts → Settings now; the old address keeps working.
definePageMeta({ layout: 'workspace', middleware: [(to) => navigateTo({ path: `/${to.params.namespace}/contacts/settings`, query: { tab: 'integrations' } }, { replace: true })] });
</script>

<template><div /></template>
