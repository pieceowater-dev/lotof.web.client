<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { metaFor, timeAgo } from '@/config/telephonyProviders';
import { getTelephonySettings, type TelephonyProviderConfig } from '@/api/contacts/telephony';

const { t, locale } = useI18n();
const route = useRoute();
const { ctx } = useCrmAuth();
const nsSlug = computed(() => route.params.namespace as string);
const items = ref<TelephonyProviderConfig[]>([]);
const loaded = ref(false);

onMounted(async () => {
  const c = await ctx();
  if (c) items.value = (await getTelephonySettings(c.token, c.ns).catch(() => null))?.configs ?? [];
  loaded.value = true;
});

function status(i: TelephonyProviderConfig) {
  if (!i.enabled) return t('contacts.integrationStatusOff');
  return i.lastEventAt ? `${t('contacts.integrationStatusOk')} · ${timeAgo(i.lastEventAt, locale.value)}` : t('contacts.integrationStatusWaiting');
}
</script>

<template>
  <div class="at-panel space-y-4">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ t('contacts.telephonyTitle') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('contacts.integrationsCardHint') }}</p>
      </div>
      <UButton :to="`/${nsSlug}/contacts/integrations`" color="emerald" icon="lucide:plug-zap">{{ t('contacts.integrationsManage') }}</UButton>
    </div>

    <div v-if="loaded && !items.length" class="text-sm text-gray-500">{{ t('contacts.integrationEmptyText') }}</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <NuxtLink
        v-for="i in items"
        :key="i.id"
        :to="`/${nsSlug}/contacts/integrations`"
        class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition"
      >
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="metaFor(i.provider).tile">
          <UIcon :name="metaFor(i.provider).icon" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="font-medium truncate">{{ i.name }}</div>
          <div class="text-xs text-gray-500 truncate">{{ status(i) }}</div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
