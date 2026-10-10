<script setup lang="ts">
// Loading placeholders in the bezel/pill language (shimmer defined in surface.css: .sk*).
// One component, several layouts, so every screen shows the *shape* of what is coming:
//   list   - avatar + two lines per row        table  - header strip + rows of cells
//   cards  - grid of cards                      kanban - columns of cards
//   panel  - titled panel with fields           stats  - KPI tiles + panel
const props = withDefaults(defineProps<{
  variant?: 'list' | 'table' | 'cards' | 'kanban' | 'panel' | 'stats';
  rows?: number;
  cols?: number;
}>(), { variant: 'list', rows: 0, cols: 0 });

const n = (def: number) => (props.rows > 0 ? props.rows : def);
const c = (def: number) => (props.cols > 0 ? props.cols : def);
// deterministic pseudo-random widths so the lines look organic but never jump between renders
const w = (i: number, j = 0) => `${45 + ((i * 37 + j * 23) % 45)}%`;
</script>

<template>
  <div class="sk-wrap" role="status" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading…</span>

    <!-- list -->
    <div v-if="variant === 'list'" class="sk-stack">
      <div v-for="i in n(5)" :key="i" class="sk-row">
        <span class="sk sk-circle" />
        <div class="sk-col">
          <span class="sk sk-line" :style="{ width: w(i) }" />
          <span class="sk sk-line sk-line--sm" :style="{ width: w(i, 2) }" />
        </div>
        <span class="sk sk-pill sk-pill--sm" />
      </div>
    </div>

    <!-- table -->
    <div v-else-if="variant === 'table'" class="sk-tray">
      <div class="sk-thead">
        <span v-for="j in c(5)" :key="j" class="sk sk-line sk-line--sm" :style="{ width: `${50 + (j * 17) % 35}%` }" />
      </div>
      <div v-for="i in n(7)" :key="i" class="sk-trow" :style="{ gridTemplateColumns: `repeat(${c(5)}, minmax(0, 1fr))` }">
        <span v-for="j in c(5)" :key="j" class="sk sk-line" :style="{ width: w(i, j) }" />
      </div>
    </div>

    <!-- cards -->
    <div v-else-if="variant === 'cards'" class="sk-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cols > 0 ? 100 / cols : 16}rem, 1fr))` }">
      <div v-for="i in n(6)" :key="i" class="sk-card">
        <div class="sk-row">
          <span class="sk sk-tile" />
          <div class="sk-col">
            <span class="sk sk-line" :style="{ width: w(i) }" />
            <span class="sk sk-line sk-line--sm" :style="{ width: w(i, 3) }" />
          </div>
        </div>
        <span class="sk sk-line" style="width: 92%" />
        <span class="sk sk-line" :style="{ width: w(i, 5) }" />
      </div>
    </div>

    <!-- kanban -->
    <div v-else-if="variant === 'kanban'" class="sk-kanban">
      <div v-for="col in c(3)" :key="col" class="sk-column">
        <span class="sk sk-line" :style="{ width: `${35 + col * 12}%` }" />
        <div v-for="i in (col % 2 ? 3 : 2)" :key="i" class="sk-card sk-card--sm">
          <span class="sk sk-line sk-line--sm" style="width: 30%" />
          <span class="sk sk-line" :style="{ width: w(i, col) }" />
          <span class="sk sk-line sk-line--sm" :style="{ width: w(i, col + 2) }" />
        </div>
      </div>
    </div>

    <!-- panel -->
    <div v-else-if="variant === 'panel'" class="sk-stack">
      <div v-for="p in n(2)" :key="p" class="sk-card">
        <span class="sk sk-line" :style="{ width: `${28 + p * 8}%` }" />
        <span class="sk sk-field" />
        <span class="sk sk-field" />
        <span class="sk sk-pill" style="width: 8rem" />
      </div>
    </div>

    <!-- stats -->
    <div v-else class="sk-stack">
      <div class="sk-grid" style="grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr))">
        <div v-for="i in n(4)" :key="i" class="sk-card sk-card--sm">
          <span class="sk sk-line sk-line--sm" style="width: 55%" />
          <span class="sk sk-line sk-line--lg" style="width: 40%" />
        </div>
      </div>
      <div class="sk-card">
        <span class="sk sk-line" style="width: 30%" />
        <span class="sk sk-block" />
      </div>
    </div>
  </div>
</template>
