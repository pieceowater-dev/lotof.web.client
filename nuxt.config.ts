// https://nuxt.com/docs/api/configuration/nuxt-config

import type { PluginOption } from 'vite';

const isProduction = process.env.NODE_ENV === 'production';

function normalizeProxyBase(envValue: string | undefined, fallbackPath: string): string {
  const override = String(envValue || '').trim();
  if (!override) return '';

  if (!/^https?:\/\//i.test(override)) {
    return override.replace(/\/$/, '');
  }

  try {
    const parsed = new URL(override);
    const normalizedPath = parsed.pathname.replace(/\/$/, '');
    if (isProduction) {
      // In production all services are expected behind one domain and standard port.
      parsed.port = '';
    }
    if (!normalizedPath || normalizedPath === '/') {
      parsed.pathname = fallbackPath;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return override.replace(/\/$/, '');
  }
}

function buildApiProxyTarget(envValue: string | undefined, fallbackPath: string, devPort: number): string {
  const overrideBase = normalizeProxyBase(envValue, fallbackPath);
  if (overrideBase) {
    return `${overrideBase}/**`;
  }

  if (!isProduction) {
    return `http://127.0.0.1:${devPort}${fallbackPath}/**`;
  }

  const siteUrl = String(process.env.NUXT_PUBLIC_SITE_URL || '').trim();
  if (siteUrl) {
    try {
      const parsedSite = new URL(siteUrl);
      parsedSite.port = '';
      return `${parsedSite.toString().replace(/\/$/, '')}${fallbackPath}/**`;
    } catch {
      return `${siteUrl.replace(/\/$/, '')}${fallbackPath}/**`;
    }
  }

  return `https://lota.tools${fallbackPath}/**`;
}

function stripInspectorPlugins(plugins: PluginOption[]): PluginOption[] {
  const result: PluginOption[] = [];
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      result.push(stripInspectorPlugins(plugin));
      continue;
    }

    const name = String((plugin as any)?.name || '');
    if (name === 'vite-plugin-vue-inspector' || name === 'vite-plugin-vue-inspector:post') {
      continue;
    }

    result.push(plugin);
  }

  return result;
}

export default defineNuxtConfig({
  ssr: true, // Enable server-side rendering for Nitro server
  
  // Route-specific rendering rules
  routeRules: {
    // The public atrace post page uses WebSocket-driven live state and must stay
    // client-side only to avoid hydration mismatches. The menu storefront under
    // /to/*/menu/** has no such dependency and is intentionally left server-rendered
    // (default ssr:true) so its per-tenant title/description/OG tags are crawlable.
    '/to/*/atrace/**': { ssr: false },
    // Static assets caching
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/favicon/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/images/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    // API routes
    '/api/**': { cors: true, headers: { 'cache-control': 'no-cache, no-store, must-revalidate' } },
    '/api-hub/**': { proxy: buildApiProxyTarget(process.env.VITE_API_HUB, '/api-hub', 8080) },
    '/api-atrace/**': { proxy: buildApiProxyTarget(process.env.VITE_API_ATRACE, '/api-atrace', 8081) },
    '/api-capital/**': { proxy: buildApiProxyTarget(process.env.VITE_API_CAPITAL, '/api-capital', 8082) },
    '/api-contacts/**': { proxy: buildApiProxyTarget(process.env.VITE_API_CONTACTS, '/api-contacts', 8083) },
    '/api-menu/**': { proxy: buildApiProxyTarget(process.env.VITE_API_MENU, '/api-menu', 8095) },
  },
  
  // Removed invalid generate.fallback (not part of current Nuxt 3 typing). For SPA fallback, provide a 404.html in /public.
  app: {
    head: {
      htmlAttrs: {
        lang: 'ru',
        translate: 'no',
        class: 'notranslate'
      },
      title: "lota",
      titleTemplate: "%s | lota",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "description", content: "Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно." },
        { name: "keywords", content: "автоматизация, учет рабочего времени, бизнес услуги, управление процессами, командная работа" },
        { name: "google-site-verification", content: "NKkJMmUBFMd8wkgPn0NWB2U1ca2FCL-JzP6RKm1reds" },
        { name: "google", content: "notranslate" },
        
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
        { name: "mobile-web-app-capable", content: "yes" },
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
        
        // Standard favicon
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" },
        
        // Apple touch icons
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon-152x152.png" },
        { rel: "apple-touch-icon", sizes: "120x120", href: "/apple-touch-icon-120x120.png" },
        { rel: "apple-touch-icon", sizes: "76x76", href: "/apple-touch-icon-76x76.png" },
        
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
  devtools: { enabled: false },
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
    plugins: [
      {
        name: 'disable-vue-inspector-virtual-modules',
        enforce: 'pre',
        resolveId(id) {
          if (
            id.startsWith('virtual:vue-inspector-path:')
            || id === 'virtual:vue-inspector-options'
            || id.includes('vite-plugin-vue-inspector/src/load.js')
            || id.includes('vite-plugin-vue-inspector/dist/load.js')
          ) {
            return `\0disabled-vue-inspector:${id}`;
          }
          return null;
        },
        load(id) {
          if (id.startsWith('\0disabled-vue-inspector:')) {
            if (id.includes('virtual:vue-inspector-options')) {
              return 'export default { vue: 3, lazyLoad: false }';
            }

            if (id.includes('virtual:vue-inspector-path:Overlay.vue')) {
              return 'export default { name: "DisabledVueInspectorOverlay", render() { return null } }';
            }

            return 'export default {}';
          }
          return null;
        }
      },
      {
        name: 'strip-vue-inspector-html-injection',
        enforce: 'post',
        transformIndexHtml(html) {
          return html
            .replace(/<script[^>]*virtual:vue-inspector-path:load\.js[^>]*><\/script>/gi, '')
            .replace(/<script[^>]*vite-plugin-vue-inspector\/src\/load\.js[^>]*><\/script>/gi, '');
        }
      }
    ],
    optimizeDeps: {
      include: ['leaflet', 'xlsx']
    },
    ssr: {
      noExternal: []
    },
    build: {
      sourcemap: true,
      commonjsOptions: {
        include: [/leaflet/, /xlsx/, /node_modules/]
      },
      rollupOptions: {
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
      crawlLinks: isProduction,
      routes: ['/', '/feed']
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
    payloadExtraction: false,
    renderJsonPayloads: false,
    componentIslands: isProduction
  },

  // Runtime config for performance
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://lota.tools',
      amplitudeApiKey: process.env.NUXT_PUBLIC_AMPLITUDE_API_KEY || ''
    }
  },

  hooks: {
    'vite:extendConfig'(config) {
      if (!Array.isArray(config.plugins)) return;
      config.plugins = stripInspectorPlugins(config.plugins);
    }
  }
});