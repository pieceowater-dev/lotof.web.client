<script setup lang="ts">
// Loading placeholder that mirrors the landing hero 1:1 (same container, paddings, heights), so nothing jumps
// when the real content replaces it: eyebrow, two-line headline, lead, the split bezel, facts, product ribbon.
</script>

<template>
  <div class="-mt-20" role="status" aria-busy="true">
    <span class="sr-only">Loading…</span>
    <div class="mx-auto max-w-7xl px-4 pt-28 pb-10 text-center sm:pt-32 md:pt-40 md:pb-14">
      <span class="sk sk-pill mx-auto" style="width: 11rem; height: 2rem" />
      <div class="mt-5 flex flex-col items-center gap-3">
        <span class="sk h-9 w-[85%] max-w-[36rem] rounded-full sm:h-10 md:h-12" />
        <span class="sk h-9 w-[60%] max-w-[26rem] rounded-full sm:h-10 md:h-12" />
      </div>
      <div class="mt-5 flex flex-col items-center gap-2.5">
        <span class="sk sk-line w-[90%] max-w-[38rem]" style="height: 1rem" />
        <span class="sk sk-line w-[70%] max-w-[28rem]" style="height: 1rem" />
      </div>

      <div class="mt-8 text-left md:mt-12">
        <div class="bezel">
          <div class="flex flex-col overflow-hidden md:flex-row" style="border-radius: calc(2rem - 0.4rem)">
            <div v-for="i in 2" :key="i" class="sk-panel flex min-h-[19rem] flex-1 flex-col p-6 md:min-h-[28rem] md:p-10">
              <div class="flex items-start justify-between gap-4">
                <span class="sk sk-pill" style="width: 8rem; height: 2rem" />
                <span class="sk sk-tile" style="width: 3.25rem; height: 3.25rem; border-radius: 1rem" />
              </div>
              <span class="sk mt-8 h-7 w-[75%] max-w-[18rem] rounded-full md:h-8" />
              <span class="sk mt-2.5 h-7 w-[55%] max-w-[13rem] rounded-full md:h-8" />
              <span class="sk sk-line mt-5 w-[85%] max-w-[18rem]" />
              <span class="sk sk-line mt-2 w-[65%] max-w-[14rem]" />
              <span class="sk mt-auto h-[3.1rem] w-52 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <span v-for="n in 3" :key="n" class="sk sk-line" :style="{ width: ['9rem', '8rem', '10rem'][n - 1] }" />
      </div>
    </div>

    <div class="flex gap-3 overflow-hidden py-2 pl-4">
      <span v-for="n in 8" :key="n" class="sk h-14 w-44 flex-none rounded-full" />
    </div>
  </div>
</template>

<style scoped>
.sk-panel { background: rgba(15, 23, 42, 0.03); }
.sk-panel + .sk-panel { box-shadow: inset 1px 0 0 rgba(15, 23, 42, 0.06); }
:global(.dark) .sk-panel { background: rgba(255, 255, 255, 0.03); }
</style>
