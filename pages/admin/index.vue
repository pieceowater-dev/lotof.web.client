<script setup lang="ts">
definePageMeta({
  middleware: 'admin'
});

await navigateTo('/console', { redirectCode: 301 });
</script>
