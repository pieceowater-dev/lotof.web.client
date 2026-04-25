/**
 * Accessibility improvements plugin
 * Adds skip links and focus management
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
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
