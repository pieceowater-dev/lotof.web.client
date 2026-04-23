<script setup lang="ts">
definePageMeta({
  middleware: 'admin'
});

await navigateTo('/console/admins', { redirectCode: 302 });
</script>
