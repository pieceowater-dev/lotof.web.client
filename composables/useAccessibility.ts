/**
 * Accessibility composable
 * Provides utilities for improved accessibility
 */

/**
 * Announces a message to screen readers
 */
export const useAnnounce = () => {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (import.meta.server) return

    const announcer = document.getElementById('announcer') || createAnnouncer()
    announcer.setAttribute('aria-live', priority)
    announcer.textContent = message

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = ''
    }, 1000)
  }

  const createAnnouncer = () => {
    const announcer = document.createElement('div')
    announcer.id = 'announcer'
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    announcer.setAttribute('role', 'status')
    announcer.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `
    document.body.appendChild(announcer)
    return announcer
  }

  return { announce }
}

/**
 * Trap focus within an element
 */
export const useFocusTrap = () => {
  const trapFocus = (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    
    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus()
          e.preventDefault()
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)
    
    // Focus first element
    firstFocusable?.focus()

    return () => {
      element.removeEventListener('keydown', handleTabKey)
    }
  }

  return { trapFocus }
}

/**
 * Keyboard navigation helper
 */
export const useKeyboardNav = () => {
  const onEscape = (callback: () => void) => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback()
      }
    }

    onMounted(() => {
      document.addEventListener('keydown', handler)
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', handler)
    })
  }

  return { onEscape }
}
