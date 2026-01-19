<template>
  <div class="w-full h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
    <AppHeader />
    <main class="flex-1 min-h-0 overflow-auto w-full">
      <slot />
    </main>
  </div>
</template>