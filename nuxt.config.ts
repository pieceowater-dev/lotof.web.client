// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  ssr: false, // Disable server-side rendering (pure SPA)
  // Removed invalid generate.fallback (not part of current Nuxt 3 typing). For SPA fallback, provide a 404.html in /public.
  app: {
    head: {
      title: "lota",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
        { name: "description", content: "services" },
        { name: "keywords", content: "automations" },
        { property: "og:title", content: "lota" },
        { property: "og:description", content: "lota" },
      ],
      style: [
        {
          children: `
            #preloader {
              position: fixed;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              backdrop-filter: blur(5px);
              -webkit-backdrop-filter: blur(5px);
              z-index: 9999;
            }
          `,
        },
      ],
    },
  },
  components: true,
  compatibilityDate: "2025-03-01",
  devtools: { enabled: true },
  modules: ["@nuxt/ui", "@nuxtjs/color-mode"],
  css: [
    '@/assets/css/fonts.css',
    '@/assets/css/global.css'
  ],
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  ui: {
    global: true
  },
  alias: {
    // Simple relative aliases (Nuxt resolves from project root)
    '@gql-hub': './api/__generated__/hub-types.ts',
    '@gql-atrace': './api/__generated__/atrace-types.ts'
  },
  vite: {
    optimizeDeps: {
      include: ['leaflet', 'xlsx']
    },
    ssr: {
      noExternal: []
    },
    build: {
      commonjsOptions: {
        include: [/leaflet/, /xlsx/, /node_modules/]
      },
      rollupOptions: {
        external: ['leaflet', 'leaflet/dist/leaflet.css', 'xlsx']
      }
    }
  },
  nitro: {
    externals: {
      inline: ['leaflet', 'xlsx']
    }
  }
});