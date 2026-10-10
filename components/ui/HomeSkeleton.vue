<script setup lang="ts">
// Loading placeholder shaped like the landing hero: eyebrow, headline, lead, and the two path cards.
</script>

<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pt-24 pb-16 md:pt-32" role="status" aria-busy="true">
    <span class="sr-only">Loading…</span>
    <span class="sk sk-pill" style="width: 9rem" />
    <span class="sk mt-6" style="height: 3rem; width: min(34rem, 90%); border-radius: 9999px" />
    <span class="sk mt-3" style="height: 3rem; width: min(24rem, 70%); border-radius: 9999px" />
    <span class="sk sk-line mt-6" style="width: min(30rem, 85%)" />
    <span class="sk sk-line mt-2" style="width: min(22rem, 65%)" />
    <div class="mt-12 grid w-full gap-5 md:grid-cols-2">
      <div v-for="i in 2" :key="i" class="sk-card" style="min-height: 15rem">
        <span class="sk sk-tile" />
        <span class="sk sk-line sk-line--lg mt-4" style="width: 60%" />
        <span class="sk sk-line mt-2" style="width: 85%" />
        <span class="sk sk-line mt-1" style="width: 70%" />
        <span class="sk sk-pill mt-auto" style="width: 11rem" />
      </div>
    </div>
  </div>
</template>
