export default defineNuxtRouteMiddleware(async (to) => {
  // Pages under /:namespace/... should validate namespace param and sync to global state
  const nsParam = (to.params as any)?.namespace as string | undefined;
  if (!nsParam) return;

  // Avoid SSR redirect loops: validate only on client where cookies/state exist
  if (process.server) return;

  const { all, load, syncFromRoute } = useNamespace();

  // Ensure namespaces are loaded before validation
  if (!all.value.length) {
    await load();
  }

  if (!all.value.includes(nsParam)) {
    // Unknown namespace for this user → go home
    return navigateTo('/', { replace: true });
  }

  // Valid → sync selection
  syncFromRoute(nsParam);
});
