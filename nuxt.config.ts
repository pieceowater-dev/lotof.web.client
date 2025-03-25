// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false, // Disable server-side rendering
  target: 'static', // Enable static site generation
  generate: {
    fallback: '404.html', // Fallback for SPA routing
  },
  app: {
    head: {
      title: "lota",
      meta: [
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
  modules: ["@nuxt/ui"],
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  ui: {
    global: true
  }
});
