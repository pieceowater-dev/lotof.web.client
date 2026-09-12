<script lang="ts" setup>
import PlanComparisonTable from '@/components/billing/PlanComparisonTable.vue';
import ContactSupportBanner from '@/components/ui/ContactSupportBanner.vue';
import { useAppPlansPage, type AppPlansPageConfig } from '@/composables/useAppPlansPage';
import LegalLinks from '@/components/ui/LegalLinks.vue';

const props = defineProps<{ config: AppPlansPageConfig }>();

const {
  t,
  nsSlug,
  appBundle,
  plans,
  loading,
  error,
  selectedInterval,
  subscribingPlanCode,
  activeSubscription,
  displayedPlans,
  goBack,
  isPlanActive,
  getPlanFeatures,
  formatPrice,
  formatPlanFeature,
  subscribePlan,
} = useAppPlansPage(props.config);
</script>

<template>
  <!-- min-h-full, NOT min-h-screen: this renders inside the app shell's
       already-height-bounded <main>, so a full 100vh here forced a phantom
       viewport of empty grey below the cards and shoved the footer out of
       view ("прилип/обрезан"). -->
  <div class="min-h-full bg-gray-50 dark:bg-gray-900">
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              {{ t('app.subscriptionPlans') || 'Subscription Plans' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.choosePlanDescription') || 'Choose a plan that works best for your team' }}
            </p>
          </div>
          <UButton
            icon="lucide:arrow-left"
            size="xs"
            color="primary"
            variant="soft"
            class="min-w-fit gap-2"
            @click="goBack"
          >
            <span class="hidden sm:inline">{{ t('app.back') }}</span>
          </UButton>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ContactSupportBanner class="mb-8" />

      <div class="flex justify-center mb-8">
        <div class="relative inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-700 p-1.5 bg-gray-50 dark:bg-gray-800/50 shadow-sm">
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="selectedInterval = 'monthly'"
          >
            {{ t('app.monthly') || 'Monthly' }}
          </button>
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="selectedInterval = 'yearly'"
          >
            <span>{{ t('app.yearly') || 'Yearly' }}</span>
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-0.5" />
              {{ t('app.bestPrice') || 'Best price' }}
            </span>
          </button>
        </div>
      </div>

      <div class="mb-5 flex items-center gap-2">
        <UIcon name="lucide:credit-card" class="h-5 w-5 text-primary-600 dark:text-primary-300" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('app.tariffsSectionTitle') || 'Тарифы' }}
        </h2>
      </div>

      <div v-if="loading" class="flex justify-center items-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        :title="t('common.error') || 'Error'"
        :description="error"
        class="mb-6"
      />

      <div v-else class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mx-auto">
        <div
          v-for="plan in displayedPlans"
          :key="plan.id"
          class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
        >
          <div v-if="plan.trialDays > 0" class="absolute top-0 right-0">
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-bl-2xl shadow-lg">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-gift" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ plan.trialDays }} {{ t('app.daysTrial') || 'days trial' }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-1 flex-col p-6 pt-12">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {{ plan.name }}
            </h3>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2 min-h-[2.5rem]">
              {{ t('app.' + plan.description) || plan.description }}
            </p>

            <div class="mb-6">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-bold text-gray-900 dark:text-white">
                  {{ formatPrice(plan.trialDays > 0 ? 0 : plan.amountCents, plan.currency) }}
                </span>
                <s
                  v-if="plan.trialDays > 0 && plan.amountCents > 0"
                  class="text-xl font-semibold text-gray-400 line-through dark:text-gray-500"
                >{{ formatPrice(plan.amountCents, plan.currency) }}</s>
                <span class="text-lg text-gray-500 dark:text-gray-400">
                  / {{ selectedInterval === 'monthly' ? (t('app.month') || 'month') : (t('app.year') || 'year') }}
                </span>
              </div>
              <div v-if="plan.trialDays > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ t('app.afterTrial') || 'После триала' }}:
                <span class="font-semibold">{{ formatPrice(plan.amountCents, plan.currency) }}</span>
                / {{ selectedInterval === 'monthly' ? (t('app.month') || 'month') : (t('app.year') || 'year') }}
              </div>
            </div>

            <div class="flex-1 space-y-3 mb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <template v-if="plan.trialDays === 0">
                    <span class="font-semibold">{{ t('app.freeForever') || 'Free forever' }}</span>
                  </template>
                  <template v-else>
                    <span class="font-semibold">{{ plan.trialDays }}</span> {{ t('app.daysFreeTrial') || 'days free trial' }}
                  </template>
                </span>
              </div>

              <div
                v-for="feature in getPlanFeatures(plan)"
                :key="feature.key"
                class="flex items-start gap-3"
              >
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {{ formatPlanFeature(feature) }}
                </span>
              </div>
            </div>

            <UButton
              v-if="!isPlanActive(plan)"
              block
              size="lg"
              :color="plan.code.includes('start') ? 'primary' : 'gray'"
              :variant="plan.code.includes('start') ? 'solid' : 'outline'"
              :disabled="subscribingPlanCode !== null"
              class="font-semibold dark:hover:bg-primary-900/30 dark:hover:border-primary-500 dark:hover:text-primary-100"
              @click="subscribePlan(plan)"
            >
              <template v-if="subscribingPlanCode === plan.code">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                {{ t('app.connecting') || 'Connecting...' }}
              </template>
              <template v-else>
                {{ t('app.selectPlan') || 'Select Plan' }}
              </template>
            </UButton>

            <div
              v-else
              class="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
              {{ t('app.activePlan') || 'Подключено!' }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && !error && displayedPlans.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p class="text-gray-500 dark:text-gray-400">
          {{ t('app.noPlansAvailable') || 'No plans available' }}
        </p>
      </div>

      <!-- Bundles are a distinct thing from the app's own tariffs: separate
           section, its own header, a rule between them. -->
      <BillingBundlesForApp
        :application-code="appBundle"
        :namespace="nsSlug"
        :interval="selectedInterval"
        class="mt-14 border-t border-gray-200 dark:border-gray-800 pt-10"
      />

      <LegalLinks context="payment" class="mt-8" />

      <PlanComparisonTable
        v-if="!loading && !error"
        :plans="displayedPlans"
        :active-plan-id="activeSubscription?.planId"
        :currency="displayedPlans[0]?.currency"
      />
    </div>
  </div>
</template>
