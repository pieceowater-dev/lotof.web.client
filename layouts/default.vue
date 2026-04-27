<template>
  <div class="app-shell w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <!-- blur strip covering the bottom gap -->
    <div class="fixed bottom-0 left-0 right-0 h-4 z-40 backdrop-blur-sm pointer-events-none" />
    <main class="main-scroll flex-1 min-h-0 overflow-auto w-full pt-20 pb-safe-or-4">
      <slot />
    </main>
  </div>
</template>