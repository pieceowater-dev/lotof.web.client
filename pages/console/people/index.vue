<script setup lang="ts">
definePageMeta({
  layout: 'quiet',
  middleware: 'admin'
});

await navigateTo('/console/admins', { redirectCode: 302 });
</script>
