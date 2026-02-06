/**
 * Performance monitoring middleware
 * Tracks page navigation performance
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.client) {
    // Start performance measurement
    const navigationStart = performance.now()
    
    // Log navigation after component is mounted
    onNuxtReady(() => {
      const navigationEnd = performance.now()
      const duration = navigationEnd - navigationStart
      
      // Only log in development
      if (import.meta.dev) {
        console.log(`[Performance] Navigation to ${to.path}: ${duration.toFixed(2)}ms`)
      }
      
      // Send to analytics in production (if available)
      if (!import.meta.dev && (window as any).gtag) {
        (window as any).gtag('event', 'timing_complete', {
          name: 'page_navigation',
          value: Math.round(duration),
          event_category: 'performance'
        })
      }
    })
  }
})
