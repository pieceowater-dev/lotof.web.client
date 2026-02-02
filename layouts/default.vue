<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full pt-12 pb-safe-or-4">
      <slot />
    </main>
  </div>
</template>