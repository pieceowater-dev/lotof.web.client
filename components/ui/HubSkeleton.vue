<script setup lang="ts">
// Loading placeholder that mirrors the hub launcher 1:1 (account bar, app grid in its bezel, namespace bar,
// first news row), same container and paddings as the real thing, so nothing jumps when it swaps in.
</script>

<template>
  <div class="-mt-20" role="status" aria-busy="true">
    <span class="sr-only">Loading…</span>
    <div class="mx-auto max-w-7xl px-4 pb-12 pt-24 md:pb-16 md:pt-28">
      <!-- account bar -->
      <div class="flex flex-wrap items-center gap-3 md:gap-4">
        <span class="sk h-[3.25rem] w-[3.25rem] flex-shrink-0 md:h-[3.75rem] md:w-[3.75rem]" style="border-radius: 9999px" />
        <div class="min-w-0 flex-1">
          <span class="sk sk-line" style="width: 5rem; height: 0.7rem" />
          <span class="sk mt-2 block h-6 w-full max-w-[11rem] md:h-7" style="border-radius: 9999px" />
          <span class="sk sk-line mt-2 hidden sm:block" style="width: 11rem; height: 0.7rem" />
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
          <span class="sk h-10 w-10 flex-shrink-0 sm:w-36" style="border-radius: 9999px" />
          <span class="sk h-10 w-10 flex-shrink-0" style="border-radius: 9999px" />
          <span class="sk h-10 w-10 flex-shrink-0" style="border-radius: 9999px" />
        </div>
      </div>

      <!-- apps -->
      <div class="mt-5">
        <div class="bezel">
          <div class="bezel-core px-3 py-6 sm:px-6 md:py-8">
            <div class="grid grid-cols-3 gap-x-2 gap-y-7 sm:grid-cols-4 md:flex md:flex-wrap md:justify-start md:gap-x-5 md:[&>*]:w-28">
              <div v-for="n in 8" :key="n" class="flex flex-col items-center gap-2.5">
                <span class="sk" style="width: min(100%, 5.25rem); aspect-ratio: 1; border-radius: 1.4rem" />
                <span class="sk sk-line" :style="{ width: ['3.4rem', '4rem', '3rem', '3.8rem'][n % 4], height: '0.7rem' }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- namespace bar -->
      <div class="mt-5">
        <div class="bezel">
          <div class="bezel-core flex items-center gap-3 px-4 py-3 md:px-5">
            <span class="sk h-10 w-10 flex-shrink-0 rounded-2xl" />
            <div class="min-w-0 flex-1">
              <span class="sk sk-line hidden sm:block" style="width: 6rem; height: 0.6rem" />
              <span class="sk mt-1.5 block h-5 w-full max-w-[11rem]" style="border-radius: 9999px" />
            </div>
            <span class="sk h-10 w-10 flex-shrink-0" style="border-radius: 9999px" />
            <span class="sk h-10 w-10 flex-shrink-0" style="border-radius: 9999px" />
          </div>
        </div>
      </div>
    </div>

    <!-- news / feed -->
    <div class="mx-auto max-w-7xl px-4 py-10">
      <div class="mb-5 flex items-center gap-3">
        <span class="sk h-9 w-9 rounded-xl" />
        <span class="sk h-6 w-40" style="border-radius: 9999px" />
      </div>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 3" :key="n" class="sk-card" style="min-height: 15rem">
          <span class="sk w-full" style="height: 7rem; border-radius: 1rem" />
          <span class="sk sk-line sk-line--lg mt-4" style="width: 80%" />
          <span class="sk sk-line mt-2" style="width: 60%" />
        </div>
      </div>
    </div>
  </div>
</template>
