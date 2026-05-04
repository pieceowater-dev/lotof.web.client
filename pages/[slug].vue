<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

definePageMeta({
  viewTransition: false,
});

type ArticleMeta = Record<string, string | string[]>;

const route = useRoute();

const mdFiles = import.meta.glob('../public/content/publications/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseFrontMatter(raw: string): { meta: ArticleMeta } {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {} };
  const meta: ArticleMeta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"|"$/g, '');
  }
  return { meta };
}

function normalizeCategoryFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const pubIdx = parts.lastIndexOf('publications');
  return pubIdx !== -1 && parts[pubIdx + 1] ? parts[pubIdx + 1].toLowerCase() : '';
}

const slug = computed(() => String(route.params.slug || '').trim().toLowerCase());

const redirect = computed(() => {
  for (const [filePath, raw] of Object.entries(mdFiles)) {
    const { meta } = parseFrontMatter(raw);
    const fileSlug = String(meta.slug || '').trim().toLowerCase();
    if (fileSlug !== slug.value) continue;
    const category = String(meta.category || normalizeCategoryFromPath(filePath)).toLowerCase();
    return `/${category}/${fileSlug}`;
  }
  return null;
});

if (redirect.value) {
  await navigateTo(redirect.value, { redirectCode: 301 });
} else {
  throw createError({ statusCode: 404, statusMessage: 'Article not found' });
}
</script>

<template>
  <div />
</template>

