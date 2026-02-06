/**
 * Web Vitals monitoring composable
 * Tracks Core Web Vitals for performance monitoring
 */
export const useWebVitals = () => {
  if (import.meta.server) return

  const reportWebVital = (metric: any) => {
    // Log in development
    if (import.meta.dev) {
      console.log(`[Web Vitals] ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta
      })
    }

    // Send to analytics in production
    if (!import.meta.dev && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        value: Math.round(metric.value),
        metric_id: metric.id,
        metric_value: metric.value,
        metric_delta: metric.delta,
        event_category: 'Web Vitals'
      })
    }
  }

  onMounted(() => {
    // Check if browser supports Performance Observer
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          const value = lastEntry.renderTime || lastEntry.loadTime
          reportWebVital({
            name: 'LCP',
            value,
            rating: value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor',
            delta: value,
            id: 'v3-' + Date.now()
          })
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {
        console.warn('LCP observation failed:', e)
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            const value = entry.processingStart - entry.startTime
            reportWebVital({
              name: 'FID',
              value,
              rating: value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor',
              delta: value,
              id: 'v3-' + Date.now()
            })
          })
        })
        fidObserver.observe({ type: 'first-input', buffered: true })
      } catch (e) {
        console.warn('FID observation failed:', e)
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          reportWebVital({
            name: 'CLS',
            value: clsValue,
            rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
            delta: clsValue,
            id: 'v3-' + Date.now()
          })
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {
        console.warn('CLS observation failed:', e)
      }
    }

    // Time to First Byte (TTFB)
    if (window.performance && window.performance.timing) {
      const navTiming = window.performance.timing
      const ttfb = navTiming.responseStart - navTiming.requestStart
      reportWebVital({
        name: 'TTFB',
        value: ttfb,
        rating: ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs-improvement' : 'poor',
        delta: ttfb,
        id: 'v3-' + Date.now()
      })
    }
  })
}
