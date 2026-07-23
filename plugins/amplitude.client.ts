/**
 * Initialize Amplitude product analytics on app start.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    useAnalytics().init()
  }
})
