/**
 * Initialize font optimization
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    useFontOptimization()
  }
})
