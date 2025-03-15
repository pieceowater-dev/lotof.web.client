export default defineNuxtRouteMiddleware((to) => {
    if (to.path === '/') return; // Разрешаем доступ к index.vue
    
    const token = useCookie('token').value;
    if (!token) {
      return navigateTo('/');
    }
  });