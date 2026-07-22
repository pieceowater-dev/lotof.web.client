<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.billing')" 
      :description="t('admin.billingDesc')"
    >
      <template #actions>
        <button
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
          @click="openCreatePlan"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span>{{ t('admin.newPlan') }}</span>
        </button>
      </template>
    </AdminHeader>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Icon name="svg-spinners:ring-resize" class="h-12 w-12 text-blue-600" />
        <p class="text-slate-500 animate-pulse">{{ t('admin.loadingBilling') }}...</p>
      </div>

      <div v-else>
        <!-- Project Selector -->
        <div class="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Для какого приложения вы настраиваете биллинг?
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="project in projects"
              :key="project.id"
              @click="selectedProject = project.id"
              :class="[
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                selectedProject === project.id
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600'
              ]"
            >
              <Icon :name="project.icon" class="h-4 w-4" />
              <span>{{ project.title }}</span>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-8 flex gap-4 border-b border-slate-200 dark:border-slate-800">
          <button
            @click="activeTab = 'plans'"
            :class="[
              'px-4 py-2 font-semibold transition-all duration-200',
              activeTab === 'plans'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            ]"
          >
            {{ t('admin.plans') }}
          </button>
          <button
            @click="activeTab = 'accounts'"
            :class="[
              'px-4 py-2 font-semibold transition-all duration-200',
              activeTab === 'accounts'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            ]"
          >
            {{ t('admin.accounts') }}
          </button>
          <button
            @click="activeTab = 'subscriptions'"
            :class="[
              'px-4 py-2 font-semibold transition-all duration-200',
              activeTab === 'subscriptions'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            ]"
          >
            {{ t('admin.subscriptions') }}
          </button>
          <button
            @click="activeTab = 'invoices'"
            :class="[
              'px-4 py-2 font-semibold transition-all duration-200',
              activeTab === 'invoices'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            ]"
          >
            {{ t('admin.invoices') }}
          </button>
        </div>

        <!-- Accounts Tab -->
        <div v-show="activeTab === 'accounts'">
          <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.billingAccounts') }}
          </h3>
          <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">ID</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Owner</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.displayName') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.email') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Plan</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.created') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="account in billingData?.adminAccounts.accounts"
                  :key="account.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-4 font-mono text-[10px] text-slate-500">{{ account.id }}</td>
                  <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">{{ account.namespace }}</td>
                  <td class="px-6 py-4">
                    <div v-if="account.owner" class="flex flex-col">
                      <span class="text-xs font-medium text-slate-900 dark:text-white">{{ account.owner.username }}</span>
                      <span class="text-[10px] text-slate-500">{{ account.owner.email }}</span>
                    </div>
                    <span v-else class="text-slate-400 text-xs">-</span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ account.displayName }}</td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ account.billingEmail }}</td>
                  <td class="px-6 py-4">
                    <div v-if="account.subscriptions?.subscriptions?.length" class="flex flex-col gap-1">
                      <div 
                        v-for="sub in account.subscriptions.subscriptions" 
                        :key="sub.id"
                        class="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30"
                      >
                        {{ getPlanName(sub.planId) }}
                      </div>
                    </div>
                    <span v-else class="text-[10px] text-slate-400 italic">No Subscription</span>
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                      {{ account.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ new Date(account.createdAt).toLocaleDateString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Plans Tab -->
        <div v-show="activeTab === 'plans'">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ t('admin.pricingPlans') }} · {{ selectedProjectTitle }}
            </h3>
            <button
              class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30 transition-colors"
              @click="openCreatePlan"
            >
              <Icon name="lucide:plus" class="h-3.5 w-3.5" />
              {{ t('admin.newPlan') }}
            </button>
          </div>

          <div v-if="!selectedProjectPlans.length" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {{ t('admin.noPlanCreated') }}
          </div>

          <div v-else class="grid gap-6 md:grid-cols-3">
            <div
              v-for="plan in selectedProjectPlans"
              :key="plan.id"
              class="relative rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              :class="plan.status === 'PLAN_ARCHIVED' ? 'opacity-50' : ''"
            >
              <div class="flex items-start justify-between gap-2">
                <h4 class="text-lg font-bold text-slate-900 dark:text-white">{{ plan.name }}</h4>
                <span
                  v-if="plan.status === 'PLAN_ARCHIVED'"
                  class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >{{ t('admin.archived') }}</span>
              </div>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ resolvePlanDescription(plan) }}</p>
              <div class="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
                {{ (plan.amountCents / 100).toFixed(0) }} {{ plan.currency }}
                <span class="text-sm">/{{ t(`admin.interval.${plan.interval.toLowerCase()}`) }}</span>
              </div>
              <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>{{ t('admin.currency') }}: {{ plan.currency }}</li>
                <li>{{ t('admin.trialDays') }}: {{ plan.trialDays }}</li>
                <li class="font-mono text-[11px] text-slate-400">{{ plan.code }}</li>
              </ul>
              <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  class="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  @click="openEditPlan(plan)"
                >
                  <Icon name="lucide:pencil" class="h-3 w-3" />
                  {{ t('admin.edit') }}
                </button>
                <button
                  v-if="plan.status !== 'PLAN_ARCHIVED'"
                  class="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                  @click="onArchivePlan(plan)"
                >
                  <Icon name="lucide:archive" class="h-3 w-3" />
                  {{ t('admin.archive') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscriptions Tab -->
        <div v-show="activeTab === 'subscriptions'">
          <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.activeSubscriptions') }} · {{ selectedProjectTitle }}
          </h3>
          <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.plan') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.periodEnd') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="subscription in selectedProjectSubscriptions"
                  :key="subscription.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900 dark:text-white">{{ subscription.namespace }}</div>
                    <div v-if="subscription.namespaceSlug" class="text-[10px] text-slate-500 font-mono">{{ subscription.namespaceSlug }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="font-medium text-slate-700 dark:text-slate-300">{{ subscription.plan }}</span>
                  </td>
                  <td class="px-6 py-4">
                    <span 
                      :class="[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        subscription.status === 'ACTIVE' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                      ]"
                    >
                      <span :class="['h-1.5 w-1.5 rounded-full', subscription.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400']"></span>
                      {{ subscription.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ subscription.periodEnd }}</td>
                  <td class="px-6 py-4">
                    <button class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                      <Icon name="lucide:more-vertical" class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Invoices Tab -->
        <div v-show="activeTab === 'invoices'">
          <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.invoices') }} · {{ selectedProjectTitle }}
          </h3>
          <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.invoice') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.amount') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.date') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="invoice in selectedProjectInvoices"
                  :key="invoice.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-4 font-mono text-xs text-slate-900 dark:text-white">{{ invoice.id }}</td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ invoice.namespace }}</td>
                  <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">{{ invoice.amount }}</td>
                  <td class="px-6 py-4">
                    <span
                      :class="[
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        invoice.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                      ]"
                    >
                      {{ invoice.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ invoice.date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      <!-- Coming Soon Notice -->
      <div class="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <div class="flex gap-3">
          <Icon name="lucide:info" class="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 class="font-semibold text-amber-900 dark:text-amber-200">
              {{ t('admin.billingIntegration') }}
            </h4>
            <p class="mt-1 text-sm text-amber-800 dark:text-amber-300">
              {{ t('admin.billingIntegrationDesc') }}
            </p>
          </div>
        </div>
      </div>
    </div> <!-- End v-else -->
  </div> <!-- End mx-auto -->

  <!-- Create / Edit Plan Modal -->
  <Teleport to="body">
    <div
      v-if="planModal.open"
      class="fixed inset-0 z-[70] overflow-y-auto p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
      @click.self="closePlanModal"
    >
      <div class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ planModal.mode === 'create' ? t('admin.newPlan') : t('admin.editPlanTitle') }}
          </h3>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="closePlanModal">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('admin.planForApp') }}: <strong>{{ selectedProjectTitle }}</strong>
          </p>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planName') }} *</label>
            <input
              v-model="planForm.name"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="A-Trace Pro"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planDescription') }}</label>
            <textarea
              v-model="planForm.description"
              rows="2"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.currency') }} *</label>
              <input
                v-model="planForm.currency"
                type="text"
                maxlength="3"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="KZT"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.trialDays') }}</label>
              <input
                v-model.number="planForm.trialDays"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <template v-if="planModal.mode === 'create'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.monthlyPrice') }} *</label>
                <input
                  v-model.number="planForm.monthlyPrice"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.yearlyPrice') }} *</label>
                <input
                  v-model.number="planForm.yearlyPrice"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <p class="text-[11px] text-slate-400">{{ t('admin.planCreatesBothIntervals') }}</p>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planCode') }}</label>
              <input
                :value="generatedCodePrefix"
                type="text"
                disabled
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>
          </template>

          <template v-else>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {{ t('admin.price') }} ({{ planModal.plan?.interval === 'YEAR' ? t('admin.interval.year') : t('admin.interval.month') }}) *
              </label>
              <input
                v-model.number="planForm.amount"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </template>

          <p v-if="planModal.error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {{ planModal.error }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="closePlanModal"
          >
            {{ t('app.cancel') || 'Отмена' }}
          </button>
          <button
            :disabled="planModal.saving"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            @click="submitPlanModal"
          >
            <Icon v-if="planModal.saving" name="svg-spinners:ring-resize" class="h-3.5 w-3.5" />
            {{ t('app.save') || 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</div> <!-- End min-h-screen -->
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { capitalGetAdminBillingInfo, capitalCreatePlan, capitalUpdatePlan, capitalArchivePlan, type AdminBillingInfo } from '@/api/capital/admin';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { token } = useAuth();
const toast = useToast();
const activeTab = ref('plans');
const loading = ref(true);
const billingData = ref<AdminBillingInfo | null>(null);

const projects = [
  { id: 'atrace', appCode: 'pieceowater.atrace', title: 'Lota A-Trace', icon: 'lucide:scan-line' },
  { id: 'contacts', appCode: 'pieceowater.contacts', title: 'Lota Contacts', icon: 'lucide:users-round' },
  { id: 'menu', appCode: 'pieceowater.menu', title: 'Lota Orders', icon: 'lucide:receipt-text' }
] as const;

type ProjectId = (typeof projects)[number]['id'];
const selectedProject = ref<ProjectId>('atrace');
const selectedProjectTitle = computed(() => {
  return projects.find(p => p.id === selectedProject.value)?.title || selectedProject.value;
});
const selectedProjectAppCode = computed(() => {
  return projects.find(p => p.id === selectedProject.value)?.appCode || selectedProject.value;
});

function getPlanName(planId: string) {
  if (!billingData.value) return planId;
  const plan = billingData.value.adminPlans?.find(p => p.id === planId);
  return plan ? plan.name : planId;
}

// Legacy plans seeded via cfg.go store `description` as an i18n key suffix
// (e.g. "pieceowater.atrace.free.description"), resolved on the public
// pricing page via t('app.' + description). Mirror that here so admins see
// the real text instead of the raw key; plans created via this console store
// literal text, which simply won't match any key and falls through as-is.
function resolvePlanDescription(plan: { description?: string | null; code: string }): string {
  const raw = (plan.description || '').trim();
  if (!raw) return plan.code;
  return t('app.' + raw) || raw;
}

// Watch for project changes for automatic data refresh
watch(selectedProject, () => {
  refreshData();
});

async function refreshData() {
  if (!token.value) {
    console.warn('[billing] No auth token available in refreshData');
    return;
  }
  loading.value = true;
  try {
    console.log('[billing] Fetching data for project:', selectedProject.value);
    // Explicitly pass an empty namespace if we want to list all, 
    // but the backend is currently set to filter by prefix in computed properties anyway.
    // However, if we want to list *only* specific namespace on backend:
    // billingData.value = await capitalGetAdminBillingInfo(token.value, 1, 100, selectedNamespace.value);
    
    billingData.value = await capitalGetAdminBillingInfo(token.value, 1, 100, undefined, selectedProjectAppCode.value);
    console.log('[billing] Data received:', {
      accounts: billingData.value?.adminAccounts?.accounts?.length,
      plans: billingData.value?.adminPlans?.length,
      subs: billingData.value?.adminSubscriptions?.subscriptions?.length,
      invoices: billingData.value?.adminInvoices?.invoices?.length
    });
  } catch (e) {
    console.error('[billing] Failed to fetch billing data', e);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  // Ensure token is ready if useAuth hasn't finished initializing on hard refresh
  if (!token.value) {
    const { fetchUser, initialized } = useAuth();
    if (!initialized.value) {
      await fetchUser();
    }
  }
  refreshData();
});

const selectedProjectPlans = computed(() => {
  // Server already filters by the resolved applicationCode (see refreshData).
  return billingData.value?.adminPlans || [];
});

// ─── Plan create/edit modal ────────────────────────────────────────────────
type PlanRow = AdminBillingInfo['adminPlans'][number];

const planModal = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  plan: null as PlanRow | null,
  saving: false,
  error: '',
});

const planForm = reactive({
  name: '',
  description: '',
  currency: 'KZT',
  trialDays: 0,
  monthlyPrice: 0,
  yearlyPrice: 0,
  amount: 0,
});

function slugifyPlanName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'plan';
}

const generatedCodePrefix = computed(() => {
  return `kz.${selectedProjectAppCode.value}.${slugifyPlanName(planForm.name)}`;
});

function openCreatePlan() {
  planModal.mode = 'create';
  planModal.plan = null;
  planModal.error = '';
  planForm.name = '';
  planForm.description = '';
  planForm.currency = 'KZT';
  planForm.trialDays = 0;
  planForm.monthlyPrice = 0;
  planForm.yearlyPrice = 0;
  planModal.open = true;
}

function openEditPlan(plan: PlanRow) {
  planModal.mode = 'edit';
  planModal.plan = plan;
  planModal.error = '';
  planForm.name = plan.name;
  planForm.description = plan.description || '';
  planForm.currency = plan.currency;
  planForm.trialDays = plan.trialDays;
  planForm.amount = plan.amountCents / 100;
  planModal.open = true;
}

function closePlanModal() {
  if (planModal.saving) return;
  planModal.open = false;
}

async function submitPlanModal() {
  if (!token.value) return;
  planModal.error = '';

  if (!planForm.name.trim()) {
    planModal.error = t('admin.planNameRequired') || 'Введите название тарифа';
    return;
  }
  if (!planForm.currency.trim()) {
    planModal.error = t('admin.currencyRequired') || 'Укажите валюту';
    return;
  }

  planModal.saving = true;
  try {
    if (planModal.mode === 'create') {
      const codePrefix = generatedCodePrefix.value;
      await capitalCreatePlan(token.value, {
        code: `${codePrefix}-monthly`,
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        currency: planForm.currency.trim().toUpperCase(),
        interval: 'MONTH',
        amountCents: Math.round(planForm.monthlyPrice * 100),
        trialDays: planForm.trialDays || 0,
        applicationCode: selectedProjectAppCode.value,
      });
      await capitalCreatePlan(token.value, {
        code: `${codePrefix}-yearly`,
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        currency: planForm.currency.trim().toUpperCase(),
        interval: 'YEAR',
        amountCents: Math.round(planForm.yearlyPrice * 100),
        trialDays: planForm.trialDays || 0,
        applicationCode: selectedProjectAppCode.value,
      });
      toast.add({ title: t('admin.planCreated') || 'Тариф создан', color: 'green' });
    } else if (planModal.plan) {
      await capitalUpdatePlan(token.value, planModal.plan.id, {
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        amountCents: Math.round(planForm.amount * 100),
        trialDays: planForm.trialDays || 0,
      });
      toast.add({ title: t('admin.planUpdated') || 'Тариф обновлён', color: 'green' });
    }

    planModal.open = false;
    await refreshData();
  } catch (e: any) {
    planModal.error = e?.message || (t('admin.planSaveFailed') || 'Не удалось сохранить тариф');
  } finally {
    planModal.saving = false;
  }
}

async function onArchivePlan(plan: PlanRow) {
  if (!token.value) return;
  const { confirm } = useConfirm();
  const confirmed = await confirm({
    title: t('admin.archivePlanConfirmTitle') || 'Архивировать тариф?',
    message: `«${plan.name}» (${plan.code})`,
    confirmLabel: t('admin.archive') || 'Архивировать',
    color: 'red',
    icon: 'lucide:archive',
  });
  if (!confirmed) return;

  try {
    await capitalArchivePlan(token.value, plan.id);
    toast.add({ title: t('admin.planArchived') || 'Тариф архивирован', color: 'green' });
    await refreshData();
  } catch (e: any) {
    toast.add({
      title: t('admin.planSaveFailed') || 'Не удалось архивировать тариф',
      description: e?.message,
      color: 'red',
    });
  }
}

const selectedProjectSubscriptions = computed(() => {
  if (!billingData.value) return [];
  const subs = billingData.value.adminSubscriptions?.subscriptions || [];
  const plans = billingData.value.adminPlans || [];
  const accounts = billingData.value.adminAccounts?.accounts || [];

  return subs
    .filter(s => {
      const plan = plans.find(p => p.id === s.planId);
      // Filter subscriptions by plan ID that belongs to selected project
      return plan?.code.toLowerCase().includes(selectedProject.value.toLowerCase());
    })
    .map(s => {
      const plan = plans.find(p => p.id === s.planId);
      const acc = accounts.find(a => a.id === s.accountId);
      return {
        id: s.id,
        namespace: acc?.displayName || acc?.namespace || s.accountId || 'unknown',
        namespaceSlug: acc?.namespace,
        plan: plan?.name || plan?.code || 'unknown',
        status: s.status,
        periodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : 'N/A'
      };
    });
});

const selectedProjectInvoices = computed(() => {
  if (!billingData.value) return [];
  const invoices = billingData.value.adminInvoices?.invoices || [];
  const accounts = billingData.value.adminAccounts?.accounts || [];
  const plans = billingData.value.adminPlans || [];
  const subs = billingData.value.adminSubscriptions?.subscriptions || [];

  return invoices
    .filter(inv => {
      // Try to find if this invoice belongs to the selected project
      const sub = subs.find(s => s.accountId === inv.accountId);
      if (!sub) return true; // Show orphaned invoices
      const plan = plans.find(p => p.id === sub.planId);
      return plan?.code.toLowerCase().includes(selectedProject.value.toLowerCase());
    })
    .map(inv => {
      const acc = accounts.find(a => a.id === inv.accountId);
      return {
        id: inv.number || inv.id,
        namespace: acc?.displayName || acc?.namespace || inv.accountId || 'unknown',
        namespaceSlug: acc?.namespace,
        amount: `${inv.totalCents / 100} ${inv.currency || 'USD'}`,
        status: inv.status,
        date: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : 'N/A'
      };
    });
});
</script>

