export default defineNuxtRouteMiddleware(async (to) => {
  // Pages under /:namespace/... should validate namespace param and sync to global state
  const nsParam = (to.params as any)?.namespace as string | undefined;
  if (!nsParam) return;

  const { all, load, syncFromRoute } = useNamespace();

  // Ensure namespaces are loaded before validation
  if (!all.value.length) {
    await load();
  }

  if (!all.value.includes(nsParam)) {
    // Unknown namespace for this user → go home
    return navigateTo('/');
  }

  // Valid → sync selection
  syncFromRoute(nsParam);
});
