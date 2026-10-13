<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { hubTelegramStatus, hubCreateTelegramLink, hubUnlinkTelegram, type TelegramStatus } from '@/api/hub/telegram';

// Connect your own Telegram to get lota's notifications there (new tasks,
// hand-overs ...). You tap "Connect", Telegram opens the bot with a one-time
// code, press Start -- done. Hidden while the platform has no bot set up.
const props = defineProps<{ token: string }>();
const { t } = useI18n();
const toast = useToast();

const status = ref<TelegramStatus | null>(null);
const busy = ref(false);
const waiting = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let stopAt = 0;

const visible = computed(() => !!status.value?.enabled);

async function load() {
  try {
    status.value = await hubTelegramStatus(props.token);
  } catch (e) {
    logError('[TelegramConnect] status failed', e);
    status.value = null;
  }
}

function stopWaiting() {
  waiting.value = false;
  if (timer) { clearInterval(timer); timer = null; }
}

async function connect() {
  busy.value = true;
  try {
    const link = await hubCreateTelegramLink(props.token);
    window.open(link.url, '_blank', 'noopener');
    waiting.value = true;
    stopAt = Date.now() + 10 * 60 * 1000;
    timer = setInterval(async () => {
      await load();
      if (status.value?.linked) {
        stopWaiting();
        toast.add({ title: t('profile.telegramLinked'), color: 'primary' });
      } else if (Date.now() > stopAt) {
        stopWaiting();
      }
    }, 3000);
  } catch (e) {
    logError('[TelegramConnect] connect failed', e);
    toast.add({ title: t('common.error'), color: 'red' });
  } finally {
    busy.value = false;
  }
}

async function disconnect() {
  busy.value = true;
  try {
    await hubUnlinkTelegram(props.token);
    await load();
  } catch (e) {
    logError('[TelegramConnect] unlink failed', e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
onBeforeUnmount(stopWaiting);
</script>

<template>
  <div v-if="visible" class="rounded-2xl border border-gray-200 dark:border-gray-800 p-3.5 space-y-2.5">
    <div class="flex items-center gap-2">
      <Icon name="simple-icons:telegram" class="w-5 h-5 text-sky-500" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">{{ t('profile.telegramTitle') }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          <template v-if="status?.linked">{{ t('profile.telegramOn') }}<template v-if="status?.username"> · @{{ status.username }}</template></template>
          <template v-else>{{ t('profile.telegramHint') }}</template>
        </div>
      </div>
      <button v-if="status?.linked" type="button" class="at-btn !px-3 !py-1.5" :disabled="busy" @click="disconnect">{{ t('profile.telegramDisconnect') }}</button>
      <button v-else type="button" class="at-btn at-btn--blue !px-3 !py-1.5" :disabled="busy || waiting" @click="connect">
        <Icon :name="waiting ? 'lucide:loader-2' : 'lucide:send'" class="w-4 h-4" :class="{ 'animate-spin': waiting }" />{{ waiting ? t('profile.telegramWaiting') : t('profile.telegramConnect') }}
      </button>
    </div>
    <p v-if="waiting" class="text-xs text-gray-500 dark:text-gray-400">{{ t('profile.telegramPressStart') }}</p>
  </div>
</template>
