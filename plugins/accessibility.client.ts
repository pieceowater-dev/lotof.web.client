/**
 * Accessibility improvements plugin
 * Adds skip links and focus management
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    // Add skip to main content link
    onNuxtReady(() => {
      const skipLink = document.createElement('a')
      skipLink.href = '#main-content'
      skipLink.className = 'skip-link'
      skipLink.textContent = 'Перейти к основному содержимому'
      skipLink.setAttribute('aria-label', 'Перейти к основному содержимому страницы')
      
      // Add styles for skip link
      const style = document.createElement('style')
      style.textContent = `
        .skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: #000;
          color: #fff;
          padding: 8px 16px;
          text-decoration: none;
          z-index: 100000;
          border-radius: 0 0 4px 0;
          font-weight: 600;
          transition: top 0.2s;
        }
        .skip-link:focus {
          top: 0;
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
        }
      `
      
      document.head.appendChild(style)
      document.body.insertBefore(skipLink, document.body.firstChild)
    })

    // Improve focus visibility
    const focusStyle = document.createElement('style')
    focusStyle.textContent = `
      *:focus-visible {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
      }
      
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
      }
    `
    document.head.appendChild(focusStyle)
  }
})
