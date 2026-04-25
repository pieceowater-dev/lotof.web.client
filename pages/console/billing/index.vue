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
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span>{{ t('admin.newPlan') }}</span>
        </button>
      </template>
    </AdminHeader>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
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

      <!-- Plans Tab -->
      <div v-show="activeTab === 'plans'">
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.pricingPlans') }} · {{ selectedProjectTitle }}
        </h3>
        <div class="grid gap-6 md:grid-cols-3">
          <div
            v-for="plan in selectedProjectPlans"
            :key="plan.id"
            class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <h4 class="text-lg font-bold text-slate-900 dark:text-white">{{ plan.name }}</h4>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ plan.subtitle }}</p>
            <div class="mt-4 text-3xl font-bold text-slate-900 dark:text-white">{{ plan.price }}<span class="text-sm">/mo</span></div>
            <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li v-for="feature in plan.features" :key="feature">✓ {{ feature }}</li>
            </ul>
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
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">{{ subscription.namespace }}</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ subscription.plan }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                    <div class="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
                    {{ subscription.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ subscription.periodEnd }}</td>
                <td class="px-6 py-4">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:edit-2" class="h-4 w-4" />
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
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">{{ invoice.id }}</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ invoice.namespace }}</td>
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">{{ invoice.amount }}</td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                      invoice.status === 'Pending'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const activeTab = ref('plans');

const projects = [
  { id: 'atrace', title: 'Lota A-Trace', icon: 'lucide:scan-line' },
  { id: 'contacts', title: 'Lota Contacts', icon: 'lucide:users-round' }
] as const;

type ProjectId = (typeof projects)[number]['id'];
const selectedProject = ref<ProjectId>('atrace');

const selectedProjectTitle = computed(() => {
  return projects.find(project => project.id === selectedProject.value)?.title || 'Lota A-Trace';
});

// Фейковые данные для визуализации
const plansByProject = {
  atrace: [
    {
      id: 'atrace-free',
      name: 'Free',
      subtitle: 'Для небольшой команды',
      price: '$0',
      features: ['1 локация', 'Базовый учёт посещаемости']
    },
    {
      id: 'atrace-pro',
      name: 'Pro',
      subtitle: 'Для растущих команд',
      price: '$29',
      features: ['Неограниченные локации', 'Расширенная аналитика', 'Экспорт отчётов']
    },
    {
      id: 'atrace-enterprise',
      name: 'Enterprise',
      subtitle: 'Для сетей и холдингов',
      price: '$99',
      features: ['SLA', 'Выделенная поддержка', 'Индивидуальные лимиты']
    }
  ],
  contacts: [
    {
      id: 'contacts-free',
      name: 'Free',
      subtitle: 'Для старта CRM',
      price: '$0',
      features: ['До 500 клиентов', 'Базовые поля карточки']
    },
    {
      id: 'contacts-pro',
      name: 'Pro',
      subtitle: 'Для активных продаж',
      price: '$39',
      features: ['До 10 000 клиентов', 'Сегменты и теги', 'Импорт из Excel']
    },
    {
      id: 'contacts-enterprise',
      name: 'Enterprise',
      subtitle: 'Для больших баз и команд',
      price: '$129',
      features: ['Без лимита клиентов', 'Кастомные правила', 'Расширенная безопасность']
    }
  ]
};

const subscriptionsByProject = {
  atrace: [
    { id: 'atrace-sub-1', namespace: 'production', plan: 'Pro', status: 'Active', periodEnd: '2026-05-23' },
    { id: 'atrace-sub-2', namespace: 'staging', plan: 'Free', status: 'Active', periodEnd: '2026-06-01' }
  ],
  contacts: [
    { id: 'contacts-sub-1', namespace: 'production', plan: 'Enterprise', status: 'Active', periodEnd: '2026-07-10' },
    { id: 'contacts-sub-2', namespace: 'partners', plan: 'Pro', status: 'Active', periodEnd: '2026-06-18' }
  ]
};

const invoicesByProject = {
  atrace: [
    { id: 'INV-AT-001', namespace: 'production', amount: '$87.00', status: 'Paid', date: '2026-04-01' },
    { id: 'INV-AT-002', namespace: 'staging', amount: '$29.00', status: 'Paid', date: '2026-04-15' },
    { id: 'INV-AT-003', namespace: 'production', amount: '$87.00', status: 'Pending', date: '2026-04-23' }
  ],
  contacts: [
    { id: 'INV-CT-001', namespace: 'production', amount: '$129.00', status: 'Paid', date: '2026-04-03' },
    { id: 'INV-CT-002', namespace: 'partners', amount: '$39.00', status: 'Pending', date: '2026-04-19' }
  ]
};

const selectedProjectPlans = computed(() => plansByProject[selectedProject.value]);
const selectedProjectSubscriptions = computed(() => subscriptionsByProject[selectedProject.value]);
const selectedProjectInvoices = computed(() => invoicesByProject[selectedProject.value]);
</script>

