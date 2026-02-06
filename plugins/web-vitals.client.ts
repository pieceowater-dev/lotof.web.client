/**
 * Initialize Web Vitals monitoring on app start
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    // Initialize Web Vitals tracking
    useWebVitals()
  }
})
