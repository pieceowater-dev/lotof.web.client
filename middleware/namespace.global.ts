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

  // Always sync selection from the route. If the namespace isn't yet in the loaded list,
  // we still allow navigation and optimistically switch the context; downstream data
  // fetches will enforce permissions. This enables deep-linking directly to another
  // namespace without an unnecessary redirect to home.
  syncFromRoute(nsParam);
});
