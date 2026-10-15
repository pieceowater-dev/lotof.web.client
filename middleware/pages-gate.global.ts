import { PAGES_ENABLED } from '@/config/apps';

// lota Pages is not released: outside local development / a VITE_PAGES_ENABLED build its routes
// (/{namespace}/pages/**) behave as if they did not exist for users.
export default defineNuxtRouteMiddleware((to) => {
  if (PAGES_ENABLED) return;
  if (/^\/[^/]+\/pages(\/|$)/.test(to.path)) {
    return navigateTo('/', { replace: true });
  }
});
