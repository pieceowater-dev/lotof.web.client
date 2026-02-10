<script setup lang="ts">
import { computed } from 'vue';
import type { SubscriptionStatus } from '@/api/atrace/subscription/plan';
import { useI18n } from '@/composables/useI18n';

interface Props {
  modelValue: boolean;
  subscriptionStatus?: SubscriptionStatus | null;
  isExpired?: boolean;
  isPastDue?: boolean;
  isTrialing?: boolean;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'renew': [];
  'close': [];
}>();

const { t } = useI18n();

const statusMessage = computed(() => {
  if (props.isExpired) {
    return t('billing.subscriptionExpired') || 'Your subscription has expired!';
  }
  if (props.isPastDue) {
    return t('billing.subscriptionPastDue') || 'Your subscription payment is past due.';
  }
  if (props.isTrialing) {
    return props.trialEndsAt
      ? `Your trial ends on ${formatDate(props.trialEndsAt)}`
      : t('billing.trialEndsMessage') || 'Your trial is about to end.';
  }
  return t('billing.renewCTA') || 'Please renew your subscription to continue.';
});

const buttonText = computed(() => {
  if (props.isExpired || props.isPastDue) {
    return t('billing.renewSubscription') || 'Renew Subscription';
  }
  return t('billing.upgradePlan') || 'Upgrade Plan';
});

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function handleRenew() {
  emit('renew');
}

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <Modal
    :modelValue="modelValue"
    @update:modelValue="handleClose"
    :header="t('billing.renewalModalTitle') || 'Subscription Renewal Required'"
    :content="statusMessage"
    :footerButtons="[
      {
        label: t('billing.dismiss') || 'Dismiss',
        variant: 'outline',
        onClick: handleClose,
      },
      {
        label: buttonText,
        variant: 'solid',
        color: 'primary',
        onClick: handleRenew,
      },
    ]"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <Icon
          name="heroicons:exclamation-triangle"
          :class="[
            'w-5 h-5',
            isExpired || isPastDue ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400',
          ]"
        />
        <span>{{ t('billing.renewalModalTitle') || 'Subscription Renewal Required' }}</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-gray-700 dark:text-gray-300">{{ statusMessage }}</p>

      <div v-if="currentPeriodEnd" class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          <span class="font-semibold">{{ t('billing.periodEnd') || 'Current Period Ends:' }}</span>
          {{ formatDate(currentPeriodEnd) }}
        </p>
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{
          t('billing.renewalInfo') ||
          'Without an active subscription, you can only view records and generate QR codes. All other features will be unavailable.'
        }}
      </p>
    </div>
  </Modal>
</template>
