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
      // Liquid-glass toast cards: a diagonal light-to-tint gradient (the
      // "sheen" a curved glass pane catches), heavy blur + saturation boost
      // so whatever's behind bleeds through in color, a bright inset line
      // along the top edge (glass catching light) layered with a soft
      // diffused drop shadow for elevation, and a near-white hairline ring
      // to read as a distinct pane rather than a flat tinted rectangle.
      // Slot keys per node_modules/@nuxt/ui .../notification.js.
      notification: {
        background: 'bg-gradient-to-br from-white/90 via-white/70 to-blue-50/50 dark:from-gray-900/85 dark:via-gray-900/70 dark:to-blue-950/40 backdrop-blur-2xl backdrop-saturate-[180%]',
        shadow: 'shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25),0_2px_10px_-4px_rgba(15,23,42,0.15),inset_0_1px_0_0_rgba(255,255,255,0.8)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6),0_2px_10px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
        rounded: 'rounded-[22px]',
        ring: 'ring-1 ring-white/70 dark:ring-white/10',
        title: 'text-sm font-semibold text-gray-900 dark:text-white',
        description: 'mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300',
        progress: {
          base: 'absolute bottom-0 end-0 start-0 h-1',
          background: 'bg-{color}-500/80 dark:bg-{color}-400/80'
        },
        default: {
          color: 'primary',
          timeout: 5000
        },
        // A snappier pop-and-slide instead of Nuxt UI's plain fade — enters
        // with a soft overshoot (cubic-bezier ~ease-out-back), exits quickly.
        transition: {
          enterActiveClass: 'transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          enterFromClass: 'opacity-0 scale-95 translate-x-6',
          enterToClass: 'opacity-100 scale-100 translate-x-0',
          leaveActiveClass: 'transition-all duration-200 ease-in',
          leaveFromClass: 'opacity-100 scale-100 translate-x-0',
          leaveToClass: 'opacity-0 scale-95 translate-x-6'
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
  