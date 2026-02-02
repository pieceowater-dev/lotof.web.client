<template>
  <div class="w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <main class="flex-1 min-h-0 overflow-auto w-full pt-12">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>