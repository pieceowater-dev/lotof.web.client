<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { REAUTH_EVENT } from '@/utils/reauth';

// Asks the person to confirm their identity with Google again before a
// sensitive action (secrets, integrations). After Google the browser returns
// to the same page and the action can be repeated.
const { t } = useI18n();
const { login } = useAuth();
const open = ref(false);

function show() { open.value = true; }
function confirm() {
  open.value = false;
  login(window.location.pathname + window.location.search, { reauth: true });
}

onMounted(() => window.addEventListener(REAUTH_EVENT, show));
onBeforeUnmount(() => window.removeEventListener(REAUTH_EVENT, show));
</script>

<template>
  <UModal v-model="open" class="at-modal">
    <div class="p-5 space-y-4">
      <div class="flex items-center gap-3">
        <span class="icon-tile !h-10 !w-10"><Icon name="lucide:shield-check" class="w-5 h-5" /></span>
        <h3 class="at-h2">{{ t('security.reauthTitle') }}</h3>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('security.reauthText') }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="at-btn" @click="open = false">{{ t('common.cancel') }}</button>
        <button type="button" class="at-btn at-btn--primary" @click="confirm"><Icon name="simple-icons:google" class="w-4 h-4" />{{ t('security.reauthConfirm') }}</button>
      </div>
    </div>
  </UModal>
</template>
