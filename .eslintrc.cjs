module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'vuejs-accessibility'],
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
    useFetch: 'readonly',
    useRequestURL: 'readonly',
    useRequestHeaders: 'readonly',
    useRequestFetch: 'readonly',
    refreshCookie: 'readonly',
    reloadNuxtApp: 'readonly',
    // Nuxt server (H3)
    defineEventHandler: 'readonly',
    defineNitroPlugin: 'readonly',
    getCookie: 'readonly',
    getHeader: 'readonly',
    getQuery: 'readonly',
    getRouterParam: 'readonly',
    getRequestHost: 'readonly',
    getRequestProtocol: 'readonly',
    readBody: 'readonly',
    send: 'readonly',
    sendRedirect: 'readonly',
    setCookie: 'readonly',
    setHeader: 'readonly',
    setResponseStatus: 'readonly',
    setResponseHeader: 'readonly',
    // Nuxt UI / other auto-imported
    useToast: 'readonly',
    useI18n: 'readonly',
    // App-specific auto-imported composables
    useAuth: 'readonly',
    useNamespace: 'readonly',
    useFriendships: 'readonly',
    useFontOptimization: 'readonly',
    useWebVitals: 'readonly',
    useAnalytics: 'readonly',
    useConfirm: 'readonly',
    useMenuToken: 'readonly',
    useMenuStaffRole: 'readonly',
    useGoodsToken: 'readonly',
    useGoodsStaffRole: 'readonly',
    usePatronAuth: 'readonly',
    usePreferredSpace: 'readonly',
    useTasksToken: 'readonly',
    // App-specific auto-imported utils (utils/siteUrl.ts, utils/renderMarkdown.ts)
    DEFAULT_SITE_URL: 'readonly',
    fillSiteHost: 'readonly',
    resolveSiteHost: 'readonly',
    resolveSiteUrl: 'readonly',
    sanitizeHtml: 'readonly',
    // Browser API types (used as TypeScript type annotations, not runtime values)
    PositionOptions: 'readonly',
    PermissionState: 'readonly',
    PermissionName: 'readonly',
    ScrollBehavior: 'readonly',
    BlobPart: 'readonly',
    GeolocationPosition: 'readonly',
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Visibility only (warn, not error) -- ~480 existing `: any`/`as any`
    // (FRONTEND_AUDIT.md A3/F1) would turn the required CI lint step red
    // the moment this becomes 'error'. Warn now so the count stops growing
    // silently; ratchet to error once there's a real plan to pay it down.
    '@typescript-eslint/no-explicit-any': 'warn',
    // Disable base rule in favour of TypeScript-aware version
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // `cond ? doA() : doB()` as a bare statement is a real, intentional
    // pattern in this codebase (e.g. pages/[namespace]/plans/index.vue's
    // showPicker()-or-click() fallback) -- allow it and short-circuit
    // (`a && b()`) rather than have @typescript-eslint/recommended flag
    // working code as a mistake.
    '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
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
    // eslint-plugin-vuejs-accessibility (FRONTEND_AUDIT.md J2): its own
    // `recommended` config sets every one of these to 'error', which would
    // fail the required CI lint step the moment it's added -- this repo has
    // never run an a11y linter before, so the real violation count is
    // unknown until it's actually measured. Warn everywhere first; ratchet
    // individual rules to error once their count is at (or planned to) 0.
    'vuejs-accessibility/alt-text': 'warn',
    'vuejs-accessibility/anchor-has-content': 'warn',
    'vuejs-accessibility/aria-props': 'warn',
    'vuejs-accessibility/aria-role': 'warn',
    'vuejs-accessibility/aria-unsupported-elements': 'warn',
    'vuejs-accessibility/click-events-have-key-events': 'warn',
    'vuejs-accessibility/form-control-has-label': 'warn',
    'vuejs-accessibility/heading-has-content': 'warn',
    'vuejs-accessibility/iframe-has-title': 'warn',
    'vuejs-accessibility/interactive-supports-focus': 'warn',
    // Default `required: { every: ['nesting', 'id'] }` demands BOTH a
    // wrapping <label> AND a for/id pair on every label, even though either
    // one alone is already a fully valid, accessible association per HTML5/
    // WCAG (<label><input></label> needs no for/id at all). That default
    // flagged ~100 already-correct `<label><UCheckbox/>...</label>`-style
    // wraps (Nuxt UI's UCheckbox/UToggle/URadio all render a real native
    // input/button inside, confirmed by reading their source) as broken,
    // alongside genuine gaps. Relaxed to `some` -- either pattern satisfies
    // it, matching how the rule is normally used elsewhere.
    // `controlComponents` matters separately from `required`: the rule's own
    // nesting check only recognizes bare HTML control tags (input/select/
    // textarea/...) by default, so `<label><UToggle/>...</label>` still
    // failed nesting too until these were listed -- confirmed by reading the
    // rule's own validateNesting() (dist/rules/label-has-for.js), not
    // assumed from the `some` change alone.
    'vuejs-accessibility/label-has-for': ['warn', { required: { some: ['nesting', 'id'] }, controlComponents: ['UToggle', 'UCheckbox', 'URadio'] }],
    'vuejs-accessibility/media-has-caption': 'warn',
    'vuejs-accessibility/mouse-events-have-key-events': 'warn',
    'vuejs-accessibility/no-access-key': 'warn',
    'vuejs-accessibility/no-autofocus': 'warn',
    'vuejs-accessibility/no-distracting-elements': 'warn',
    'vuejs-accessibility/no-redundant-roles': 'warn',
    'vuejs-accessibility/no-static-element-interactions': 'warn',
    'vuejs-accessibility/role-has-required-aria-props': 'warn',
    'vuejs-accessibility/tabindex-no-positive': 'warn',
  },
  ignorePatterns: ['api/__generated__/**', '.nuxt/**', '.output/**']
};
