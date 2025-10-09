module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@nuxt/eslint-config-typescript'
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  ignorePatterns: ['api/__generated__/**', '.nuxt/**', '.output/**']
};
