<template>
  <div id="preloader">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120" class="animate-spin">
      <g data-idx="1">
        <circle stroke-dasharray="141.37166941154067 49.12388980384689" r="30" stroke-width="4" stroke="#7bcf63" fill="none" cy="50" cx="50" data-idx="2" transform="matrix(0.684547261237544,-0.7289684815766575,0.7289684815766575,0.684547261237544,-20.67578714071007,52.22106101695567)"></circle>
      </g>
    </svg>
  </div>

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';

const onPageLoad = () => {
  setTimeout(() => {
    document.getElementById('preloader')?.remove();
  }, 100);
};

onMounted(() => {
  if (document.readyState === 'complete') {
    onPageLoad();
  } else {
    window.addEventListener('load', onPageLoad);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('load', onPageLoad);
});
</script>