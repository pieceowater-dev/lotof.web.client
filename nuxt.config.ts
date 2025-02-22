// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: "lota",
      meta: [
        { name: "description", content: "Описание приложения" },
        { name: "keywords", content: "ключевые, слова" },
        { property: "og:title", content: "Название приложения" },
        { property: "og:description", content: "Описание для соцсетей" },
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
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  ssr: true,
  modules: ["@nuxt/ui"],
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  ui: {
    global: true
  }
});
