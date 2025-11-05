<template>
      <div class="min-h-screen h-screen max-h-screen flex flex-col overflow-hidden">
            <AppHeader />
            <main class="flex-1 min-h-0 overflow-hidden mt-10 pt-3">
                  <slot />
            </main>
            <!-- <AppFooter /> -->
      </div>
  
</template>