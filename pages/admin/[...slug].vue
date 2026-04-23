<script setup lang="ts">
const route = useRoute();
const path = Array.isArray(route.params.slug) ? route.params.slug.join('/') : '';

definePageMeta({
  middleware: 'admin'
});

await navigateTo(`/console/${path}`, { redirectCode: 301 });
</script>
