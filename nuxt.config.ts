// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  ssr: true, // Enable server-side rendering for Nitro server
  
  // Route-specific rendering rules
  routeRules: {
    // Public QR display pages should be client-side only to avoid hydration issues with WebSocket
    '/shared/**': { ssr: false },
    // Static assets caching
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/favicon/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/images/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    // API routes
    '/api/**': { cors: true, headers: { 'cache-control': 'no-cache, no-store, must-revalidate' } }
  },
  
  // Removed invalid generate.fallback (not part of current Nuxt 3 typing). For SPA fallback, provide a 404.html in /public.
  app: {
    head: {
      htmlAttrs: {
        lang: 'ru'
      },
      title: "lota",
      titleTemplate: "%s | lota",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
        { name: "description", content: "Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно." },
        { name: "keywords", content: "автоматизация, учет рабочего времени, бизнес услуги, управление процессами, командная работа" },
        
        // Robots
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
        { name: "googlebot", content: "index, follow" },
        
        // Performance hints
        { "http-equiv": "Accept-CH", content: "DPR, Viewport-Width, Width" },
        
        // Open Graph / Facebook
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "lota" },
        { property: "og:title", content: "lota - Платформа автоматизации бизнеса" },
        { property: "og:description", content: "Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно." },
        { property: "og:image", content: "/og-image.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "lota - Платформа автоматизации" },
        { property: "og:locale", content: "ru_RU" },
        { property: "og:locale:alternate", content: "en_US" },
        
        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "lota - Платформа автоматизации бизнеса" },
        { name: "twitter:description", content: "Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно." },
        { name: "twitter:image", content: "/og-image.png" },
        
        // Apple iOS meta tags
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "lota" },
        { name: "format-detection", content: "telephone=no" },
        
        // Theme colors
        { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
        { name: "theme-color", content: "#111827", media: "(prefers-color-scheme: dark)" },
        { name: "msapplication-TileColor", content: "#3b82f6" },
        { name: "msapplication-config", content: "/browserconfig.xml" },
        
        // Security & Privacy
        { "http-equiv": "X-UA-Compatible", content: "IE=edge" },
        { name: "referrer", content: "strict-origin-when-cross-origin" },
      ],
      link: [
        // Canonical URL (will be set dynamically per page)
        { rel: "canonical", href: "" },
        
        // DNS Prefetch & Preconnect for external resources
        { rel: "dns-prefetch", href: "//fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.googleapis.com", crossorigin: "anonymous" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
        
        // Preload critical resources
        { rel: "preload", as: "style", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
        
        // Standard favicon
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" },
        
        // Apple touch icons
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon-152x152.png" },
        { rel: "apple-touch-icon", sizes: "120x120", href: "/apple-touch-icon-120x120.png" },
        { rel: "apple-touch-icon", sizes: "76x76", href: "/apple-touch-icon-76x76.png" },
        
        // Splash screens for iOS (optional but recommended)
        { rel: "apple-touch-startup-image", href: "/apple-splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-1668x2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-1536x2048.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
        { rel: "apple-touch-startup-image", href: "/apple-splash-640x1136.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" },
        
        // Android icons
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/android-chrome-512x512.png" },
        
        // Web app manifest
        { rel: "manifest", href: "/site.webmanifest" },
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
        external: ['xlsx'],
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('@nuxt')) {
                return 'vendor'
              }
              if (id.includes('leaflet')) {
                return 'maps'
              }
            }
          }
        }
      },
      cssCodeSplit: true,
      minify: 'esbuild',
      target: 'esnext'
    },
    server: {
      middlewareMode: false,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      }
    }
  },
  nitro: {
    externals: {
      inline: ['xlsx']
    },
    prerender: {
      crawlLinks: true,
      routes: ['/']
    },
    compressPublicAssets: true,
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        }
      }
    }
  },

  // Performance optimizations
  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
    viewTransition: true,
    componentIslands: true
  },

  // Runtime config for performance
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://lota.tools'
    }
  }
});