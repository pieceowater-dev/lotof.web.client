<script lang="ts" setup>
import RouteModal from '@/components/atrace/RouteModal.vue';
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useAtraceRoutes } from '@/composables/useAtraceRoutes';
import { localizeAtraceErrorMessage } from '@/utils/atrace/localizeError';
import type { Route, RouteMilestone } from '@/api/atrace/route/list';
import type { AtracePost } from '@/api/atrace/post/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { ensure: ensureAtraceToken } = useAtraceToken();

const { routes: atraceRoutes, routesLoading, routesError, loadRoutes, createRoute, deleteRoute: deleteRouteById, buildPostLabel, sortMilestones } = useAtraceRoutes(nsSlug);

const routePosts = ref<AtracePost[]>([]);
const isRouteModalOpen = ref(false);
const editingRouteId = ref<string | null>(null);
const routeFormError = ref<string | null>(null);
const routeFormPostId = ref('');
const routeForm = reactive<{ title: string; postIds: string[] }>({
  title: '',
  postIds: [],
});

const routePostOptions = computed(() => {
  const used = new Set(routeForm.postIds);
  return routePosts.value
    .filter((post) => !used.has(post.id))
    .map((post) => ({
      label: buildPostLabel(post),
      value: post.id,
    }));
});

function getRoutePostTitle(postId: string): string {
  const post = routePosts.value.find((p) => p.id === postId);
  if (!post) return postId;
  return buildPostLabel(post);
}

function getSortedMilestones(routeItem: Route): RouteMilestone[] {
  return sortMilestones(routeItem.milestones);
}

async function loadRoutePosts() {
  if (routePosts.value.length > 0) return;
  try {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return;
    const { atracePostsList } = await import('@/api/atrace/post/list');
    const res = await atracePostsList(atraceToken, nsSlug.value, { page: 1, length: 'ONE_HUNDRED' });
    routePosts.value = [...res.posts].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  } catch {
    routePosts.value = [];
  }
}

function resetRouteForm() {
  routeForm.title = '';
  routeForm.postIds = [];
  routeFormPostId.value = '';
  routeFormError.value = null;
}

function openCreateRoute() {
  editingRouteId.value = null;
  resetRouteForm();
  isRouteModalOpen.value = true;
  loadRoutePosts();
}

function openEditRoute(routeItem: Route) {
  editingRouteId.value = routeItem.id;
  routeForm.title = routeItem.title || '';
  routeForm.postIds = sortMilestones(routeItem.milestones).map((m) => m.postId);
  routeFormPostId.value = '';
  routeFormError.value = null;
  isRouteModalOpen.value = true;
  loadRoutePosts();
}

async function saveRoute() {
  routeFormError.value = null;
  const title = routeForm.title.trim();
  if (!title) {
    routeFormError.value = t('app_route_title_required') || 'Введите название маршрута';
    return;
  }
  if (routeForm.postIds.length === 0) {
    routeFormError.value = t('app_route_posts_required') || 'Добавьте хотя бы один пост';
    return;
  }

  try {
    // Routes have no direct "update" endpoint: editing recreates the route
    // with the new milestones and deletes the old one.
    const created = await createRoute(title, routeForm.postIds);

    if (editingRouteId.value) {
      await deleteRouteById(editingRouteId.value);
      atraceRoutes.value = atraceRoutes.value.filter((r) => r.id !== editingRouteId.value);
    }
    atraceRoutes.value = [...atraceRoutes.value, created].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    isRouteModalOpen.value = false;
    resetRouteForm();
  } catch (e) {
    routeFormError.value = localizeAtraceErrorMessage(e, t) || (t('app_route_save_failed') || 'Failed to save route');
  }
}

async function handleDeleteRoute(routeItem: Route) {
  const { confirm } = useConfirm();
  const ok = await confirm({
    message: t('app_route_delete_confirm') || 'Удалить маршрут?',
    color: 'red',
    icon: 'lucide:route',
  });
  if (!ok) return;
  try {
    await deleteRouteById(routeItem.id);
    atraceRoutes.value = atraceRoutes.value.filter((r) => r.id !== routeItem.id);
  } catch (e) {
    routesError.value = localizeAtraceErrorMessage(e, t) || (t('app_route_delete_failed') || 'Failed to delete route');
  }
}

onMounted(() => {
  loadRoutes();
});
</script>

<template>
  <div class="mb-6">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
      <div>
        <h2 class="text-base font-medium">
          {{ t('app.route.list') || 'Маршруты' }}
        </h2>
        <p class="text-xs text-gray-500">
          {{ t('app.route.listHint') || 'Соберите посты в маршрут и отслеживайте прохождение' }}
        </p>
      </div>
      <UButton
        icon="lucide:plus"
        size="xs"
        color="primary"
        class="self-start w-auto"
        @click="openCreateRoute"
      >
        {{ t('app.route.create') || 'Создать маршрут' }}
      </UButton>
    </div>

    <div
      v-if="routesLoading"
      class="text-gray-500 text-sm"
    >
      {{ t('app.loading') }}
    </div>
    <div
      v-else-if="routesError"
      class="text-red-500 text-sm"
    >
      {{ routesError }}
    </div>
    <div
      v-else-if="atraceRoutes.length === 0"
      class="text-gray-500 text-sm"
    >
      {{ t('app.route.empty') || 'Маршрутов пока нет' }}
    </div>
    <div
      v-else
      class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60"
    >
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr class="text-left">
            <th class="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
              {{ t('app.route.label') || 'Маршрут' }}
            </th>
            <th class="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[55%] min-w-[320px]">
              {{ t('app.route.posts') || 'Посты' }}
            </th>
            <th class="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 text-right">
              {{ t('common.actions') || 'Actions' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="routeItem in atraceRoutes"
            :key="routeItem.id"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-4 py-3 align-top">
              <div class="font-semibold text-gray-900 dark:text-white">
                {{ routeItem.title }}
              </div>
              <div class="text-xs text-gray-500">
                {{ routeItem.milestones.length }} {{ t('app.locations') || 'постов' }}
              </div>
            </td>
            <td class="px-4 py-3 w-[55%] min-w-[320px]">
              <div class="space-y-1 whitespace-normal">
                <div
                  v-for="milestone in getSortedMilestones(routeItem)"
                  :key="`${routeItem.id}-${milestone.postId}-${milestone.priority}`"
                  class="text-gray-700 dark:text-gray-200"
                >
                  <span class="font-semibold">#{{ milestone.priority }}</span>
                  <span class="ml-2">{{ getRoutePostTitle(milestone.postId) }}</span>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                <UButton
                  size="xs"
                  variant="soft"
                  color="primary"
                  icon="lucide:pencil"
                  @click="openEditRoute(routeItem)"
                >
                  {{ t('app.route.edit') || 'Edit' }}
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="red"
                  icon="lucide:trash"
                  @click="handleDeleteRoute(routeItem)"
                >
                  {{ t('common.delete') || 'Delete' }}
                </UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Create/Edit Route Modal -->
  <RouteModal
    v-model="isRouteModalOpen"
    :title="editingRouteId ? (t('app.route.titleEdit') || 'Edit Route') : (t('app.route.titleCreate') || 'Create Route')"
    :show-edit-warning="Boolean(editingRouteId)"
    v-model:route-title="routeForm.title"
    :edit-warning="t('app.route.editWarning') || 'Изменение маршрута пересоздаст его и сбросит текущую историю прохождений.'"
    v-model:selected-post-id="routeFormPostId"
    :name-label="t('app.route.form.title') || 'Название'"
    v-model:selected-post-ids="routeForm.postIds"
    :name-placeholder="t('app.route.form.titlePlaceholder') || 'Маршрут'"
    :posts-label="t('app.route.form.posts') || 'Посты маршрута'"
    :posts-hint="t('app.route.form.postsHint') || 'Добавьте посты в нужном порядке'"
    :select-placeholder="t('app.select.location') || 'Выберите пост'"
    :empty-text="t('app.route.form.noPostsSelected') || 'Посты не выбраны'"
    :cancel-label="t('common.cancel') || 'Cancel'"
    :save-label="t('common.save') || 'Save'"
    :post-options="routePostOptions"
    :get-post-label="getRoutePostTitle"
    :error="routeFormError"
    @save="saveRoute"
  />
</template>
