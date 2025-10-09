export default defineNuxtRouteMiddleware((to) => {
  // Pages under /:namespace/... should sync param to global state
  const nsParam = (to.params as any)?.namespace as string | undefined;
  const { all, syncFromRoute } = useNamespace();

  if (nsParam) {
    // If ns from route is unknown, accept it optimistically (will be validated server-side in real app)
    if (!all.value.includes(nsParam)) {
      all.value = [...all.value, nsParam];
    }
    syncFromRoute(nsParam);
  }
});
