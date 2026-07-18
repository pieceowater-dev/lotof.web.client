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
      // Frosted-glass toast cards: translucent + blurred background instead
      // of Nuxt UI's default solid white/gray-900, softer ring, taller
      // radius. Slot keys per node_modules/@nuxt/ui .../notification.js.
      notification: {
        background: 'bg-white/75 dark:bg-gray-900/70 backdrop-blur-xl backdrop-saturate-150',
        shadow: 'shadow-xl',
        rounded: 'rounded-2xl',
        ring: 'ring-1 ring-black/5 dark:ring-white/10',
        title: 'text-sm font-semibold text-gray-900 dark:text-white',
        description: 'mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300',
        progress: {
          base: 'absolute bottom-0 end-0 start-0 h-1',
          background: 'bg-{color}-500/80 dark:bg-{color}-400/80'
        },
        default: {
          color: 'primary',
          timeout: 5000
        }
      },
      // Nuxt UI's default panel width is `w-full` (100% of the wrapping
      // relatively-positioned trigger). That only works under Popper's
      // default `strategy: 'absolute'` — once a dropdown opts into
      // `strategy: 'fixed'` (needed to escape clipping ancestors like
      // overflow-hidden cards), `w-full` resolves against the *viewport*
      // instead, stretching the panel edge-to-edge. Swap it for a
      // shrink-to-fit width with sane bounds so every USelectMenu/
      // UInputMenu behaves the same regardless of popper strategy.
      selectMenu: {
        width: 'min-w-[12rem] w-max max-w-[22rem]'
      },
      inputMenu: {
        width: 'min-w-[12rem] w-max max-w-[22rem]'
      },
      primary: 'blue',
      secondary: 'emerald',
      gray: 'neutral' // Changed from 'cool' to 'neutral' for less blue tint
    }
  })
  