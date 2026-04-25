/**
 * Font optimization composable
 * Preloads and optimizes font loading
 */
export const useFontOptimization = () => {
  if (import.meta.server) return

  if ('fonts' in document) {
    (document as any).fonts.ready.then(() => {
      document.documentElement.classList.add('fonts-loaded')
    })
    return
  }

  setTimeout(() => {
    document.documentElement.classList.add('fonts-loaded')
  }, 3000)
}
