import { pagesApi, type PagesAccess } from '@/api/pages/ops';

// What the signed-in member may do in Pages. The server enforces all of it; this only decides what to show.
export function usePagesAccess(nsSlug: () => string) {
  const access = ref<PagesAccess | null>(null);
  const loaded = ref(false);

  async function load() {
    try {
      access.value = await pagesApi.myAccess(nsSlug());
    } catch {
      access.value = { role: 'NONE', allSites: false, siteIds: [] };
    } finally {
      loaded.value = true;
    }
  }

  const role = computed(() => access.value?.role ?? 'NONE');
  const isOwner = computed(() => role.value === 'OWNER');
  // Admins manage what is on the site (design, publishing, domains); editors only write articles.
  const canManage = computed(() => role.value === 'OWNER' || role.value === 'ADMIN');
  const canWrite = computed(() => role.value !== 'NONE');

  return { access, loaded, load, role, isOwner, canManage, canWrite };
}
