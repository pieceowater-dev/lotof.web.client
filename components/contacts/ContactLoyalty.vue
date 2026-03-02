<script setup lang="ts">
import type { BonusBalance, ClientTier, StampCard, ClientStampProgress } from '@/api/contacts/loyalty';

interface Props {
  bonusBalance: BonusBalance | null;
  clientTier: ClientTier | null;
  stampCards: StampCard[];
  stampProgress: ClientStampProgress[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const { t } = useI18n();

function getProgressPercentage(current: number | undefined, total: number | undefined): number {
  if (!current || !total) return 0;
  return Math.min((current / total) * 100, 100);
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-gift" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Бонусы
        </h2>
      </div>
    </div>
    <div class="px-5 py-5 space-y-6">
      <!-- Bonus Balance -->
      <div v-if="bonusBalance">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-wallet" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Баланс
          </h3>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg p-4">
            <p class="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Всего</p>
            <p class="text-2xl font-bold text-blue-700 dark:text-blue-300">{{ bonusBalance.totalBonuses }}</p>
          </div>
          <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-lg p-4">
            <p class="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Доступно</p>
            <p class="text-2xl font-bold text-green-700 dark:text-green-300">{{ bonusBalance.availableBonuses }}</p>
          </div>
          <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 rounded-lg p-4">
            <p class="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Сгорают</p>
            <p class="text-2xl font-bold text-orange-700 dark:text-orange-300">{{ bonusBalance.expiringSoon }}</p>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-sm text-gray-500 dark:text-gray-400">Нет данных о бонусном балансе</p>
      </div>

      <!-- Client Tier -->
      <div v-if="clientTier">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-star" class="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Уровень
          </h3>
        </div>
        <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Текущий уровень</p>
              <p class="text-lg font-bold text-purple-700 dark:text-purple-300">Tier {{ clientTier.tierId }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Прогресс</p>
              <p class="text-lg font-bold text-purple-700 dark:text-purple-300">{{ clientTier.currentValue }}</p>
            </div>
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-purple-600 dark:text-purple-400">
              <span>До следующего уровня</span>
              <span>{{ clientTier.nextTierThreshold }}</span>
            </div>
            <div class="w-full bg-purple-200 dark:bg-purple-800/50 rounded-full h-2">
              <div 
                class="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300" 
                :style="{ width: `${Math.min((clientTier.currentValue / clientTier.nextTierThreshold) * 100, 100)}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-sm text-gray-500 dark:text-gray-400">Нет данных об уровне клиента</p>
      </div>

      <!-- Stamp Cards -->
      <div v-if="stampProgress.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-ticket" class="w-4 h-4 text-pink-600 dark:text-pink-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Карты штампов
          </h3>
        </div>
        <div class="space-y-3">
          <div v-for="progress in stampProgress" :key="progress.id"
            class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg p-4">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">{{ progress.stampCard?.name }}</p>
                <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">{{ progress.stampCard?.description }}</p>
              </div>
              <UBadge :color="progress.stampCard?.status === 'ACTIVE' ? 'green' : 'gray'" size="xs" variant="soft">
                {{ progress.stampCard?.status }}
              </UBadge>
            </div>
            <div class="flex items-center gap-2 mt-3">
              <div class="flex-1">
                <div class="flex justify-between text-xs text-amber-600 dark:text-amber-400 mb-1">
                  <span>{{ progress.currentStamps }} / {{ progress.stampCard?.totalStamps }}</span>
                  <span>{{ progress.completedRounds }} раундов</span>
                </div>
                <div class="w-full bg-amber-200 dark:bg-amber-800/50 rounded-full h-2">
                  <div 
                    class="bg-amber-600 dark:bg-amber-400 h-2 rounded-full transition-all duration-300" 
                    :style="{ width: `${(progress.currentStamps / (progress.stampCard?.totalStamps || 1)) * 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="stampCards.length === 0">
        <p class="text-sm text-gray-500 dark:text-gray-400">Нет активных карт штампов</p>
      </div>
    </div>
  </div>
</template>
