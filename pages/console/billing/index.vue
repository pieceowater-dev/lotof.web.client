<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.billing')" 
      :description="t('admin.billingDesc')"
    >
      <template v-if="activeTab === 'plans' || activeTab === 'subscriptions'" #actions>
        <button
          v-if="activeTab === 'plans'"
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
          @click="openCreatePlan"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span>{{ t('admin.newPlan') }}</span>
        </button>
        <button
          v-if="activeTab === 'subscriptions'"
          class="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-500/30"
          @click="openCashPaymentModal"
        >
          <Icon name="lucide:banknote" class="h-4 w-4" />
          <span>{{ t('admin.confirmCashPayment') }}</span>
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
            {{ t('admin.billingProjectSelector') }}
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
            <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">ID</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.owner') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.displayName') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.email') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.plan') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.created') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="account in pagedAccounts"
                  :key="account.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-4 font-mono text-[10px] text-slate-500">{{ account.id }}</td>
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900 dark:text-white">{{ account.namespaceTitle || account.namespace }}</div>
                    <div v-if="account.namespaceSlug" class="text-[10px] text-slate-500 font-mono">{{ account.namespaceSlug }}</div>
                  </td>
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
          <div v-if="(billingData?.adminAccounts?.accounts?.length || 0) > TABLE_PAGE_SIZE" class="mt-4 flex justify-end">
            <UPagination
              v-model="accountsPage"
              :page-count="TABLE_PAGE_SIZE"
              :total="billingData?.adminAccounts?.accounts?.length || 0"
              size="xs"
            />
          </div>
        </div>

        <!-- Plans Tab -->
        <div v-show="activeTab === 'plans'">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ t('admin.pricingPlans') }} · {{ selectedProjectTitle }}
            </h3>
          </div>

          <div v-if="!selectedProjectPlans.length" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {{ t('admin.noPlanCreated') }}
          </div>

          <div v-else class="grid gap-6 md:grid-cols-3">
            <div
              v-for="group in groupedProjectPlans"
              :key="group.name"
              class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <h4 class="text-lg font-bold text-slate-900 dark:text-white">{{ group.name }}</h4>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ resolvePlanDescription(group.plans[0]) }}</p>

              <div class="mt-4 space-y-3">
                <div
                  v-for="plan in group.plans"
                  :key="plan.id"
                  class="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                  :class="plan.status === 'PLAN_ARCHIVED' ? 'opacity-50' : ''"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-xl font-bold text-slate-900 dark:text-white">
                      {{ (plan.amountCents / 100).toFixed(0) }} {{ plan.currency }}
                      <span class="text-xs font-normal text-slate-500">/{{ t(`admin.interval.${plan.interval.toLowerCase()}`) }}</span>
                    </div>
                    <span
                      v-if="plan.status === 'PLAN_ARCHIVED'"
                      class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >{{ t('admin.archived') }}</span>
                  </div>
                  <div class="mt-2 flex flex-col gap-2">
                    <span class="break-all font-mono text-[11px] text-slate-400">{{ plan.code }}</span>
                    <div class="flex items-center gap-1.5">
                      <button
                        class="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        @click="openEditPlan(plan)"
                      >
                        <Icon name="lucide:pencil" class="h-3 w-3" />
                        {{ t('admin.edit') }}
                      </button>
                      <button
                        v-if="plan.status !== 'PLAN_ARCHIVED'"
                        class="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                        @click="onArchivePlan(plan)"
                      >
                        <Icon name="lucide:archive" class="h-3 w-3" />
                        {{ t('admin.archive') }}
                      </button>
                    </div>
                  </div>
                </div>
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
            <div class="overflow-x-auto">
            <table class="w-full min-w-[700px] text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.plan') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.periodEnd') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="subscription in pagedSubscriptions"
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
                  <td class="px-6 py-4 text-right">
                    <button
                      v-if="subscription.status === 'ACTIVE' || subscription.status === 'TRIALING'"
                      :disabled="cancelingSubscriptionId === subscription.id"
                      class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      @click="cancelSubscriptionPrompt(subscription)"
                    >
                      {{ t('admin.cancelSubscription') || 'Отменить' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
          <div v-if="selectedProjectSubscriptions.length > TABLE_PAGE_SIZE" class="mt-4 flex justify-end">
            <UPagination
              v-model="subscriptionsPage"
              :page-count="TABLE_PAGE_SIZE"
              :total="selectedProjectSubscriptions.length"
              size="xs"
            />
          </div>
        </div>

        <!-- Invoices Tab -->
        <div v-show="activeTab === 'invoices'">
          <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.invoices') }} · {{ selectedProjectTitle }}
          </h3>
          <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
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
                  v-for="invoice in pagedInvoices"
                  :key="invoice.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-4 font-mono text-xs text-slate-900 dark:text-white">{{ invoice.id }}</td>
                  <td class="px-6 py-4">
                    <div class="text-slate-700 dark:text-slate-300">{{ invoice.namespace }}</div>
                    <div v-if="invoice.namespaceSlug" class="text-[10px] text-slate-500 font-mono">{{ invoice.namespaceSlug }}</div>
                  </td>
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
          <div v-if="selectedProjectInvoices.length > TABLE_PAGE_SIZE" class="mt-4 flex justify-end">
            <UPagination
              v-model="invoicesPage"
              :page-count="TABLE_PAGE_SIZE"
              :total="selectedProjectInvoices.length"
              size="xs"
            />
          </div>
        </div>
    </div> <!-- End v-else -->
  </div> <!-- End mx-auto -->


  <ConsoleBillingPlanModal
    v-model:plan-modal="planModal"
    v-model:plan-form="planForm"
    :current-limit-keys="currentLimitKeys"
    :generated-code-prefix="generatedCodePrefix"
    :selected-project-icon="selectedProjectIcon"
    :selected-project-title="selectedProjectTitle"
    @close="closePlanModal"
    @submit="submitPlanModal"
  />
  <ConsoleBillingCashPaymentModal
    v-model:cash-payment-modal="cashPaymentModal"
    v-model:cash-payment-form="cashPaymentForm"
    :active-project-plans="activeProjectPlans"
    :selected-project-icon="selectedProjectIcon"
    :selected-project-title="selectedProjectTitle"
    @close="closeCashPaymentModal"
    @submit="submitCashPaymentModal"
  />
</div> <!-- End min-h-screen -->
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { capitalGetAdminBillingInfo, capitalGetAllAdminPlans, capitalCreatePlan, capitalUpdatePlan, capitalArchivePlan, capitalConfirmCashPayment, capitalCancelSubscription, type AdminBillingInfo } from '@/api/capital/admin';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
useHead({ title: `Консоль — ${t('admin.billing') || 'Биллинг'}` });
const { token } = useAuth();
const toast = useToast();
const activeTab = ref('plans');
const loading = ref(true);
const billingData = ref<AdminBillingInfo | null>(null);

const projects = [
  { id: 'atrace', appCode: 'pieceowater.atrace', title: 'Lota A-Trace', icon: 'lucide:scan-line' },
  { id: 'contacts', appCode: 'pieceowater.contacts', title: 'Lota Contacts', icon: 'lucide:users-round' },
  { id: 'menu', appCode: 'pieceowater.menu', title: 'Lota Orders', icon: 'lucide:receipt-text' },
  { id: 'issues', appCode: 'pieceowater.issues', title: 'Lota Issues', icon: 'lucide:clipboard-check' }
] as const;

// Known usage-limit keys per app -- these are the exact keys product
// services read to gate functionality (e.g. A-Trace checks max_employees
// before letting a team member be activated, Contacts checks max_clients
// before creating a new client). Keeping this list in sync with what each
// service actually reads is what makes the admin-managed limits meaningful
// instead of just decorative free-text.
const PLAN_LIMIT_KEYS: Record<string, Array<{ key: string; label: string }>> = {
  atrace: [
    { key: 'max_employees', label: 'Макс. сотрудников' },
    { key: 'max_posts', label: 'Макс. постов' },
  ],
  contacts: [
    { key: 'max_clients', label: 'Макс. клиентов' },
    { key: 'max_custom_fields', label: 'Макс. доп. полей' },
    { key: 'max_loyalty_programs', label: 'Макс. программ лояльности' },
  ],
  menu: [
    { key: 'max_staff', label: 'Макс. персонала' },
    { key: 'max_branches', label: 'Макс. филиалов' },
    { key: 'max_menu_items', label: 'Макс. позиций меню' },
    { key: 'max_promobanners', label: 'Макс. промо-баннеров' },
    { key: 'max_badges', label: 'Макс. бейджей' },
    { key: 'max_links', label: 'Макс. ссылок' },
  ],
  issues: [
    { key: 'max_boards', label: 'Макс. досок' },
    { key: 'max_staff', label: 'Макс. сотрудников' },
  ],
};

type ProjectId = (typeof projects)[number]['id'];
const selectedProject = ref<ProjectId>('atrace');
const selectedProjectTitle = computed(() => {
  return projects.find(p => p.id === selectedProject.value)?.title || selectedProject.value;
});
const selectedProjectIcon = computed(() => {
  return projects.find(p => p.id === selectedProject.value)?.icon || 'lucide:box';
});
const selectedProjectAppCode = computed(() => {
  return projects.find(p => p.id === selectedProject.value)?.appCode || selectedProject.value;
});

// Plans across every project (not just the currently selected one) -- an
// account's subscriptions can span multiple apps, but billingData.adminPlans
// is always filtered to the selected project (see refreshData), so a
// cross-project subscription's plan would otherwise never resolve to a name.
// Fetched once; project-independent, so no need to refetch on tab switches.
const allPlans = ref<AdminBillingInfo['adminPlans']>([]);

function getPlanName(planId: string) {
  const inProject = billingData.value?.adminPlans?.find(p => p.id === planId);
  if (inProject) return inProject.name;
  const anyProject = allPlans.value.find(p => p.id === planId);
  return anyProject ? anyProject.name : planId;
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
    // Explicitly pass an empty namespace if we want to list all,
    // but the backend is currently set to filter by prefix in computed properties anyway.
    // However, if we want to list *only* specific namespace on backend:
    // billingData.value = await capitalGetAdminBillingInfo(token.value, 1, 100, selectedNamespace.value);

    billingData.value = await capitalGetAdminBillingInfo(token.value, 1, 100, undefined, selectedProjectAppCode.value);
  } catch (e) {
    console.error('[billing] Failed to fetch billing data', e);
    // Clear rather than leave stale data on screen -- otherwise a failed
    // fetch after switching projects (e.g. an app with no plans yet, or a
    // transient backend error) silently keeps showing the PREVIOUS
    // project's plans instead of an empty/error state.
    billingData.value = null;
    toast.add({ title: t('admin.billingLoadFailed') || 'Не удалось загрузить данные биллинга', color: 'red' });
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
  if (token.value) {
    capitalGetAllAdminPlans(token.value)
      .then((plans) => { allPlans.value = plans; })
      .catch((e) => console.error('[billing] Failed to fetch all-project plans', e));
  }
});

const selectedProjectPlans = computed(() => {
  // Server already filters by the resolved applicationCode (see refreshData).
  return billingData.value?.adminPlans || [];
});

const activeProjectPlans = computed(() => {
  return selectedProjectPlans.value.filter(p => p.status !== 'PLAN_ARCHIVED');
});

// Plans are created in month/year pairs (see submitPlanModal) but come back
// from the API as flat rows -- group by name so a tier's two intervals show
// as one card instead of two disconnected, identically-titled cards.
const groupedProjectPlans = computed(() => {
  const groups = new Map<string, PlanRow[]>();
  for (const plan of selectedProjectPlans.value) {
    const key = plan.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(plan);
  }
  return Array.from(groups.entries()).map(([name, plans]) => ({
    name,
    plans: [...plans].sort((a, b) => (a.interval === b.interval ? 0 : a.interval === 'MONTH' ? -1 : 1)),
  }));
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
  // Keyed by limit key (e.g. "max_employees") -> numeric value as a string
  // for v-model binding; serialized into metadataJson on save.
  limits: {} as Record<string, string>,
});

const currentLimitKeys = computed(() => PLAN_LIMIT_KEYS[selectedProject.value] || []);

// Always returns valid JSON ("{}" when no limits are set) -- matches the
// shape the Go seeder writes (buildMetadataJSON in plan.svc.go), so product
// services parsing metadata_json never have to handle an empty/invalid string.
function buildMetadataJson(): string {
  const features = currentLimitKeys.value
    .filter(k => planForm.limits[k.key] !== '' && planForm.limits[k.key] !== undefined)
    .map(k => ({ key: k.key, label: k.label, value: Number(planForm.limits[k.key]) }));
  if (!features.length) return '{}';
  return JSON.stringify({ features });
}

function loadLimitsFromMetadata(metadataJson: string | null | undefined) {
  planForm.limits = {};
  if (!metadataJson) return;
  try {
    const parsed = JSON.parse(metadataJson);
    const features = Array.isArray(parsed?.features) ? parsed.features : [];
    for (const f of features) {
      if (f && typeof f.key === 'string' && f.value !== undefined) {
        planForm.limits[f.key] = String(f.value);
      }
    }
  } catch {
    // Malformed/legacy metadata -- leave limits empty rather than crash the modal.
  }
}

// Cyrillic (Russian + Kazakh) -> Latin, so a plan named entirely in Cyrillic
// doesn't get stripped down to nothing by the ASCII-only cleanup below --
// that was silently collapsing every Cyrillic name to the same "plan"
// fallback, causing a duplicate-code error on the second such plan.
const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};
function transliterate(value: string): string {
  return value.replace(/[а-яёәғқңөұүһі]/g, (c) => CYRILLIC_TRANSLIT[c] ?? c);
}

function slugifyPlanName(value: string): string {
  return transliterate(String(value || '').toLowerCase())
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
  planForm.limits = {};
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
  loadLimitsFromMetadata(plan.metadataJson);
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
      const metadataJson = buildMetadataJson();
      const monthlyResult: any = await capitalCreatePlan(token.value, {
        code: `${codePrefix}-monthly`,
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        currency: planForm.currency.trim().toUpperCase(),
        interval: 'MONTH',
        amountCents: Math.round(planForm.monthlyPrice * 100),
        trialDays: planForm.trialDays || 0,
        applicationCode: selectedProjectAppCode.value,
        metadataJson,
      });
      const monthlyId = monthlyResult?.createPlan?.id;

      try {
        await capitalCreatePlan(token.value, {
          code: `${codePrefix}-yearly`,
          name: planForm.name.trim(),
          description: planForm.description.trim() || undefined,
          currency: planForm.currency.trim().toUpperCase(),
          interval: 'YEAR',
          amountCents: Math.round(planForm.yearlyPrice * 100),
          trialDays: planForm.trialDays || 0,
          applicationCode: selectedProjectAppCode.value,
          metadataJson,
        });
      } catch (yearlyError: any) {
        // The monthly leg already landed -- a "the pair" plan can't exist
        // with only one interval, so best-effort archive it back out rather
        // than leaving an orphaned monthly-only plan the admin didn't ask for.
        if (monthlyId) {
          try {
            await capitalArchivePlan(token.value, monthlyId);
          } catch {
            planModal.error = (yearlyError?.message || (t('admin.planSaveFailed') || 'Не удалось сохранить тариф'))
              + ' ' + (t('admin.planPartialCreateRollbackFailed') || '(месячный план создан, но откатить его не удалось — проверьте список и заархивируйте вручную)');
            return;
          }
        }
        throw yearlyError;
      }
      toast.add({ title: t('admin.planCreated') || 'Тариф создан', color: 'green' });
    } else if (planModal.plan) {
      await capitalUpdatePlan(token.value, planModal.plan.id, {
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        amountCents: Math.round(planForm.amount * 100),
        trialDays: planForm.trialDays || 0,
        metadataJson: buildMetadataJson() ?? '',
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

// ─── Confirm cash payment modal ────────────────────────────────────────────
const cashPaymentModal = reactive({
  open: false,
  saving: false,
  error: '',
});
const cashPaymentForm = reactive({
  namespace: '',
  planCode: '',
});

function openCashPaymentModal() {
  cashPaymentForm.namespace = '';
  cashPaymentForm.planCode = '';
  cashPaymentModal.error = '';
  cashPaymentModal.open = true;
}

function closeCashPaymentModal() {
  if (cashPaymentModal.saving) return;
  cashPaymentModal.open = false;
}

async function submitCashPaymentModal() {
  if (!token.value) return;
  cashPaymentModal.error = '';

  if (!cashPaymentForm.namespace) {
    cashPaymentModal.error = t('admin.namespaceSlugRequired') || 'Укажите слаг неймспейса';
    return;
  }
  if (!cashPaymentForm.planCode) {
    cashPaymentModal.error = t('admin.planRequired') || 'Выберите тариф';
    return;
  }

  cashPaymentModal.saving = true;
  try {
    const result = await capitalConfirmCashPayment(
      token.value,
      cashPaymentForm.namespace,
      selectedProjectAppCode.value,
      cashPaymentForm.planCode
    );
    if (!result.success) {
      cashPaymentModal.error = result.error || result.message || (t('admin.cashPaymentFailed') || 'Не удалось подтвердить оплату');
      return;
    }
    toast.add({ title: t('admin.cashPaymentConfirmed') || 'Оплата наличными подтверждена', color: 'green' });
    cashPaymentModal.open = false;
    await refreshData();
  } catch (e: any) {
    cashPaymentModal.error = e?.message || (t('admin.cashPaymentFailed') || 'Не удалось подтвердить оплату');
  } finally {
    cashPaymentModal.saving = false;
  }
}

// ─── Cancel subscription ───────────────────────────────────────────────────
const cancelingSubscriptionId = ref<string | null>(null);

async function cancelSubscriptionPrompt(sub: { id: string; namespaceSlug?: string | null; namespace: string }) {
  if (!token.value || !sub.namespaceSlug) return;
  const { confirm } = useConfirm();
  const ok = await confirm({
    title: t('admin.cancelSubscriptionConfirmTitle') || 'Отменить подписку?',
    message: t('admin.cancelSubscriptionConfirmMessage') || `${sub.namespace} немедленно потеряет доступ к этому приложению.`,
    confirmLabel: t('admin.cancelSubscription') || 'Отменить подписку',
    color: 'red',
    icon: 'lucide:ban',
  });
  if (!ok) return;

  cancelingSubscriptionId.value = sub.id;
  try {
    const result = await capitalCancelSubscription(token.value, sub.namespaceSlug, selectedProjectAppCode.value);
    if (!result.success) {
      toast.add({ title: result.error || result.message || (t('admin.cancelSubscriptionFailed') || 'Не удалось отменить подписку'), color: 'red' });
      return;
    }
    toast.add({ title: t('admin.subscriptionCanceled') || 'Подписка отменена', color: 'green' });
    await refreshData();
  } catch (e: any) {
    toast.add({ title: e?.message || (t('admin.cancelSubscriptionFailed') || 'Не удалось отменить подписку'), color: 'red' });
  } finally {
    cancelingSubscriptionId.value = null;
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
        namespace: acc?.namespaceTitle || acc?.displayName || acc?.namespace || s.accountId || 'unknown',
        namespaceSlug: acc?.namespaceSlug,
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
        namespace: acc?.namespaceTitle || acc?.displayName || acc?.namespace || inv.accountId || 'unknown',
        namespaceSlug: acc?.namespaceSlug,
        amount: `${inv.totalCents / 100} ${inv.currency || 'USD'}`,
        status: inv.status,
        date: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : 'N/A'
      };
    });
});

// Client-side pagination for the three tables -- refreshData already fetches
// up to 100 rows per list in one shot, so paging is just slicing that batch
// rather than a separate server round-trip.
const TABLE_PAGE_SIZE = 10;
const accountsPage = ref(1);
const subscriptionsPage = ref(1);
const invoicesPage = ref(1);

function pageOf<T>(items: T[], page: number): T[] {
  const start = (page - 1) * TABLE_PAGE_SIZE;
  return items.slice(start, start + TABLE_PAGE_SIZE);
}

const pagedAccounts = computed(() => pageOf(billingData.value?.adminAccounts?.accounts || [], accountsPage.value));
const pagedSubscriptions = computed(() => pageOf(selectedProjectSubscriptions.value, subscriptionsPage.value));
const pagedInvoices = computed(() => pageOf(selectedProjectInvoices.value, invoicesPage.value));

watch(selectedProject, () => {
  accountsPage.value = 1;
  subscriptionsPage.value = 1;
  invoicesPage.value = 1;
});
</script>

