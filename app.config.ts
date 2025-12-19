export default defineAppConfig({
    ui: {
      modal: {
        // Center all modals on mobile instead of bottom sheet
        container: 'items-center'
      },
      icons: {
        // Use Iconify provider and hint known collections for better resolution
        provider: 'iconify',
        collections: ['lucide']
      },
      notifications: {
        // Show toasts at the top right of the screen
        position: 'top-0 bottom-[unset]'
      },
      primary: 'blue',
      gray: 'neutral' // Changed from 'cool' to 'neutral' for less blue tint
    }
  })
  