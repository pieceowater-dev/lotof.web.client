import { PAGES_ENABLED } from '@/config/apps';

// lota Pages routes (/{namespace}/pages/**) behave as if they did not exist for users only when the app is
// switched off with VITE_PAGES_ENABLED=false.
export default defineNuxtRouteMiddleware((to) => {
  if (PAGES_ENABLED) return;
  if (to.path === '/sites' || /^\/[^/]+\/pages(\/|$)/.test(to.path)) {
    return navigateTo('/', { replace: true });
  }
});
