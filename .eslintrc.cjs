module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  globals: {
    // Vue 3 auto-imports
    ref: 'readonly',
    computed: 'readonly',
    reactive: 'readonly',
    watch: 'readonly',
    watchEffect: 'readonly',
    nextTick: 'readonly',
    onMounted: 'readonly',
    onUnmounted: 'readonly',
    onBeforeUnmount: 'readonly',
    PropType: 'readonly',
    // Nuxt 3 composables
    useCookie: 'readonly',
    useState: 'readonly',
    useHead: 'readonly',
    useSeoMeta: 'readonly',
    navigateTo: 'readonly',
    useNuxtApp: 'readonly',
    useRoute: 'readonly',
    useRouter: 'readonly',
    useRuntimeConfig: 'readonly',
    useColorMode: 'readonly',
    useLazyAsyncData: 'readonly',
    useAsyncData: 'readonly',
    clearError: 'readonly',
    createError: 'readonly',
    defineAppConfig: 'readonly',
    defineNuxtConfig: 'readonly',
    defineNuxtPlugin: 'readonly',
    defineNuxtRouteMiddleware: 'readonly',
    definePageMeta: 'readonly',
    onNuxtReady: 'readonly',
    $fetch: 'readonly',
    // Nuxt server (H3)
    defineEventHandler: 'readonly',
    getCookie: 'readonly',
    getHeader: 'readonly',
    getQuery: 'readonly',
    readBody: 'readonly',
    // Nuxt UI / other auto-imported
    useToast: 'readonly',
    useI18n: 'readonly',
    // App-specific auto-imported composables
    useAuth: 'readonly',
    useNamespace: 'readonly',
    useFriendships: 'readonly',
    useFontOptimization: 'readonly',
    useWebVitals: 'readonly',
    // Browser API types (used as TypeScript type annotations, not runtime values)
    PositionOptions: 'readonly',
    PermissionState: 'readonly',
    PermissionName: 'readonly',
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Disable base rule in favour of TypeScript-aware version
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow empty catch/block statements (common pattern for intentional no-ops)
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'vue/multi-word-component-names': 'off',
    // Formatting — treat as warnings, not errors
    'vue/html-indent': 'warn',
    'vue/max-attributes-per-line': 'warn',
    'vue/html-self-closing': 'warn',
    'vue/singleline-html-element-content-newline': 'warn',
    'vue/attribute-hyphenation': 'warn',
    'vue/attributes-order': 'warn',
    'vue/html-closing-bracket-newline': 'warn',
    'vue/first-attribute-linebreak': 'warn',
  },
  ignorePatterns: ['api/__generated__/**', '.nuxt/**', '.output/**']
};
