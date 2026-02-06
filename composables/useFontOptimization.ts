/**
 * Font optimization composable
 * Preloads and optimizes font loading
 */
export const useFontOptimization = () => {
  if (import.meta.server) return

  onMounted(() => {
    // Use Font Loading API if available
    if ('fonts' in document) {
      // Wait for fonts to load
      ;(document as any).fonts.ready.then(() => {
        // Fonts are loaded, add loaded class to html
        document.documentElement.classList.add('fonts-loaded')
      })
    }

    // Fallback for browsers without Font Loading API
    if (!('fonts' in document)) {
      // Add loaded class after a timeout
      setTimeout(() => {
        document.documentElement.classList.add('fonts-loaded')
      }, 3000)
    }
  })
}
