<script lang="ts" setup>
// Integrations live in Contacts → Settings now; the old address keeps working.
definePageMeta({ layout: 'workspace', middleware: [(to) => navigateTo({ path: `/${to.params.namespace}/contacts/settings`, query: { tab: 'integrations' } }, { replace: true })] });
</script>

<template><div /></template>
