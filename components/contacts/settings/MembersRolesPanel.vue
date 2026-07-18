<script lang="ts" setup>
import { useAuth } from '@/composables/useAuth';
import { useNamespaceStaticRoles, roleTone, roleLabel, type StaticAccessRole } from '@/composables/useNamespaceStaticRoles';
import { staticRoleOptions, rolesPageSizeOptions } from '@/utils/constants/contactsSettings';

const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const {
  namespaceMembers,
  memberRoles,
  rolesLoading,
  roleSavingMemberId,
  loadMembersAndRoles,
  assignStaticRole,
} = useNamespaceStaticRoles();

const nsSlug = computed(() => route.params.namespace as string);

const rolesPage = ref(1);
const rolesPageSize = ref(10);
const showRolesLegend = ref(false);
const showRoleModal = ref(false);
const roleModalMemberId = ref<string | null>(null);
const roleModalValue = ref<StaticAccessRole>('VIEWER');

const paginatedMembers = computed(() => {
  const start = (rolesPage.value - 1) * rolesPageSize.value;
  return namespaceMembers.value.slice(start, start + rolesPageSize.value);
});
const rolesFrom = computed(() => {
  if (namespaceMembers.value.length === 0) return 0;
  return (rolesPage.value - 1) * rolesPageSize.value + 1;
});
const rolesTo = computed(() => {
  return Math.min(rolesPage.value * rolesPageSize.value, namespaceMembers.value.length);
});

const roleModalMember = computed(() => {
  if (!roleModalMemberId.value) return null;
  return namespaceMembers.value.find((member) => member.id === roleModalMemberId.value) || null;
});

function openRoleModal(memberId: string) {
  roleModalMemberId.value = memberId;
  roleModalValue.value = memberRoles.value[memberId] || 'VIEWER';
  showRoleModal.value = true;
}

function closeRoleModal() {
  showRoleModal.value = false;
  roleModalMemberId.value = null;
}

async function confirmRoleModal() {
  if (!roleModalMemberId.value) return;
  await assignStaticRole(nsSlug.value, roleModalMemberId.value, roleModalValue.value);
  toast.add({
    title: 'Успех',
    description: 'Сохранено',
    color: 'emerald',
  });
  closeRoleModal();
}

onMounted(async () => {
  rolesPage.value = 1;
  await loadMembersAndRoles(nsSlug.value, hubToken.value);
});
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 shadow-sm">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100 text-lg">
          Роли участников
        </h3>
        <UButton
          size="xs"
          color="gray"
          variant="soft"
          icon="lucide:circle-help"
          @click="showRolesLegend = !showRolesLegend"
        >
          {{ showRolesLegend ? 'Скрыть подсказку по ролям' : 'Подсказка по ролям' }}
        </UButton>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Управление ролями участников неймспейса.
      </p>
      <div
        v-if="showRolesLegend"
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
      >
        <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-900/10 p-3">
          <div class="text-sm font-semibold text-red-700 dark:text-red-300">
            Владелец
          </div>
          <p class="text-xs text-red-600/80 dark:text-red-200/80 mt-1">
            Полный контроль над неймспейсом и приложением.
          </p>
        </div>
        <div class="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10 p-3">
          <div class="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Админ
          </div>
          <p class="text-xs text-amber-600/80 dark:text-amber-200/80 mt-1">
            Расширенные полномочия: больше прав, чем у оператора.
          </p>
        </div>
        <div class="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-900/10 p-3">
          <div class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Оператор
          </div>
          <p class="text-xs text-emerald-600/80 dark:text-emerald-200/80 mt-1">
            Операционная работа с клиентами и кампаниями.
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-3">
          <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Наблюдатель
          </div>
          <p class="text-xs text-gray-600/80 dark:text-gray-300/80 mt-1">
            Доступ на просмотр без изменений.
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="rolesLoading"
      class="py-8 flex justify-center"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-5 h-5 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else-if="namespaceMembers.length === 0"
      class="text-sm text-gray-500 dark:text-gray-400 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700"
    >
      Участники не найдены в текущем неймспейсе.
    </div>

    <div
      v-else
      class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                Участник
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                Email
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                Текущая роль
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200 w-56">
                Действие
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in paginatedMembers"
              :key="member.id"
              class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
            >
              <td class="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                {{ member.username }}
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                {{ member.email }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="roleTone(memberRoles[member.id] || 'VIEWER')"
                >
                  {{ roleLabel(memberRoles[member.id] || 'VIEWER') }}
                </span>
              </td>
              <td class="px-4 py-3">
                <UButton
                  size="xs"
                  variant="soft"
                  color="primary"
                  icon="lucide:shield-check"
                  :disabled="roleSavingMemberId === member.id"
                  @click="openRoleModal(member.id)"
                >
                  Изменить роль
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap justify-between items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-700">
        <div class="text-xs text-gray-600 dark:text-gray-400">
          Показаны {{ rolesFrom }}-{{ rolesTo }} из {{ namespaceMembers.length }} участников
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 dark:text-gray-400">Строк на странице</span>
          <USelect
            :model-value="rolesPageSize"
            :options="rolesPageSizeOptions"
            class="w-20"
            size="xs"
            @update:model-value="(value) => { rolesPageSize = Number(value); rolesPage = 1; }"
          />
          <UPagination
            v-model="rolesPage"
            :page-count="rolesPageSize"
            :total="namespaceMembers.length"
            size="xs"
            :ui="{ wrapper: 'flex items-center gap-0.5', rounded: 'min-w-[28px] justify-center text-xs', default: { activeButton: { variant: 'outline' } } }"
          />
        </div>
      </div>
    </div>

    <UModal
      v-model="showRoleModal"
      @close="closeRoleModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Назначение роли
              </h3>
              <p
                v-if="roleModalMember"
                class="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                {{ roleModalMember.username }} · {{ roleModalMember.email }}
              </p>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeRoleModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Роль">
            <USelect
              v-model="roleModalValue"
              :options="staticRoleOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              @click="closeRoleModal"
            >
              Отмена
            </UButton>
            <UButton
              color="primary"
              :loading="!!roleSavingMemberId"
              @click="confirmRoleModal"
            >
              Сохранить
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
