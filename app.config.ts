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
  