export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/') return; // Allow public access to landing (index)
    
    const token = useCookie('token').value;
    if (!token) {
      return navigateTo('/');
    }
  });