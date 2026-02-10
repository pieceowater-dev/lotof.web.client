<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSubscription } from '@/composables/useSubscription';

const testBundle = ref('pieceowater.atrace');
const testNamespace = ref('ns'); // Add test namespace
const showModal = ref(false);

const subscription = useSubscription({
  appBundle: testBundle.value,
  namespaceSlug: testNamespace.value, // Pass namespace to composable
});

onMounted(async () => {
  // Auto-fetch on mount
  await subscription.fetchPlanLimits();
});

async function testFetch() {
  await subscription.fetchPlanLimits();
  console.log('✓ Subscription data loaded:', subscription.planLimits.value);
}

function testModal() {
  showModal.value = true;
}

function handleRenew() {
  console.log('✓ Renew clicked');
  showModal.value = false;
  navigateTo('/atrace/settings/plans');
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">Subscription Test Page</h1>

    <div class="space-y-6">
      <!-- Test Token Input -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">1. Setup</h2>
        </template>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">App Bundle</label>
            <UInput v-model="testBundle" placeholder="pieceowater.atrace" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Namespace Slug</label>
            <UInput v-model="testNamespace" placeholder="pieceowater" />
          </div>
          
          <UButton @click="testFetch" :loading="subscription.loading.value">
            Refresh Plan Limits
          </UButton>

          <p class="text-xs text-gray-500 dark:text-gray-400">
            ✓ Tokens are automatically retrieved from your browser cookies
          </p>
        </div>
      </UCard>

      <!-- Subscription Status -->
      <UCard v-if="subscription.planLimits.value">
        <template #header>
          <h2 class="text-xl font-semibold">2. Subscription Status</h2>
        </template>

        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="font-medium">Active:</span>
            <UBadge :color="subscription.isSubscriptionActive.value ? 'green' : 'red'">
              {{ subscription.isSubscriptionActive.value ? 'YES' : 'NO' }}
            </UBadge>
          </div>

          <div class="flex items-center gap-2">
            <span class="font-medium">Status:</span>
            <UBadge :color="subscription.isActive.value ? 'blue' : 'yellow'">
              {{ subscription.subscriptionStatus.value }}
            </UBadge>
          </div>

          <div>
            <span class="font-medium">Plan:</span>
            <span class="ml-2">{{ subscription.planCode.value }} ({{ subscription.planName.value }})</span>
          </div>

          <div v-if="subscription.trialEndsAt.value">
            <span class="font-medium">Trial Ends:</span>
            <span class="ml-2">{{ subscription.trialEndsAt.value }}</span>
          </div>

          <div>
            <span class="font-medium">Period End:</span>
            <span class="ml-2">{{ subscription.currentPeriodEnd.value }}</span>
          </div>

          <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded">
            <pre class="text-xs">{{ JSON.stringify(subscription.planLimits.value, null, 2) }}</pre>
          </div>
        </div>
      </UCard>

      <!-- Status Flags -->
      <UCard v-if="subscription.planLimits.value">
        <template #header>
          <h2 class="text-xl font-semibold">3. Status Flags</h2>
        </template>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center gap-2">
            <Icon :name="subscription.isExpired.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isExpired.value ? 'text-red-500' : 'text-gray-400'" />
            <span>isExpired</span>
          </div>

          <div class="flex items-center gap-2">
            <Icon :name="subscription.isPastDue.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isPastDue.value ? 'text-yellow-500' : 'text-gray-400'" />
            <span>isPastDue</span>
          </div>

          <div class="flex items-center gap-2">
            <Icon :name="subscription.isTrialing.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isTrialing.value ? 'text-blue-500' : 'text-gray-400'" />
            <span>isTrialing</span>
          </div>

          <div class="flex items-center gap-2">
            <Icon :name="subscription.isActive.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isActive.value ? 'text-green-500' : 'text-gray-400'" />
            <span>isActive</span>
          </div>

          <div class="flex items-center gap-2">
            <Icon :name="subscription.isCanceled.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isCanceled.value ? 'text-orange-500' : 'text-gray-400'" />
            <span>isCanceled</span>
          </div>

          <div class="flex items-center gap-2">
            <Icon :name="subscription.isIncomplete.value ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                  :class="subscription.isIncomplete.value ? 'text-purple-500' : 'text-gray-400'" />
            <span>isIncomplete</span>
          </div>
        </div>
      </UCard>

      <!-- Test Modal -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">4. Test Modal</h2>
        </template>

        <div class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Click the button to manually open the renewal modal
          </p>
          
          <UButton @click="testModal">
            Show Renewal Modal
          </UButton>
        </div>
      </UCard>

      <!-- Error Display -->
      <UCard v-if="subscription.error.value" color="red">
        <template #header>
          <h2 class="text-xl font-semibold text-red-600">Error</h2>
        </template>
        
        <p>{{ subscription.error.value }}</p>
      </UCard>
    </div>

    <!-- Renewal Modal -->
    <SubscriptionRenewalModal
      v-model="showModal"
      :subscription-status="subscription.subscriptionStatus.value"
      :is-expired="subscription.isExpired.value"
      :is-past-due="subscription.isPastDue.value"
      :is-trialing="subscription.isTrialing.value"
      :trial-ends-at="subscription.trialEndsAt.value"
      :current-period-end="subscription.currentPeriodEnd.value"
      @renew="handleRenew"
    />
  </div>
</template>
