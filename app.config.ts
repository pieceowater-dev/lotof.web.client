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
      // Toast cards use the exact same floating-glass-pill recipe as
      // AppHeader.vue's header bar / top blur strip (bg-white/90 +
      // backdrop-blur + a light border + shadow-sm + rounded-3xl) instead
      // of a heavier bespoke treatment — consistent with the one glass
      // surface already established elsewhere in this app.
      notification: {
        // Notification.vue renders TWO nested divs: an outer one carrying
        // `background`/`shadow`/`rounded`/`ring`, and an inner one (slot
        // key `container`) carrying `container`/`rounded`/`ring` again.
        // Both need the same treatment or whichever gets inspected/clips
        // looks unstyled. `ring-0`/`shadow-none` (not empty strings) are
        // required to actually cancel Nuxt UI's own defaults
        // (ring-1 ring-gray-200, shadow-lg): mergeConfig concatenates
        // rather than replaces plain-string slots, so an empty override
        // leaves the default class sitting there unopposed — only
        // another same-conflict-group utility makes tailwind-merge drop
        // it, same as `border` (its own CSS property, no conflict group
        // with `ring`) needs `ring-0` alongside it, not instead of it.
        container: 'relative overflow-hidden rounded-3xl border border-blue-100/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur ring-0',
        background: 'border border-blue-100/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur ring-0',
        shadow: 'shadow-sm',
        rounded: 'rounded-3xl',
        ring: 'ring-0',
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
  