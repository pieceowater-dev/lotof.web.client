// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'lota',
      meta: [
        { name: 'description', content: 'Описание приложения' },
        { name: 'keywords', content: 'ключевые, слова' },
        { property: 'og:title', content: 'Название приложения' },
        { property: 'og:description', content: 'Описание для соцсетей' }
      ]
    }
  },
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxt/ui'],
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
})
