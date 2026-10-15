<script setup lang="ts">
import { computed } from 'vue';
import { statusBadgeStyle, nextStatuses } from '@/utils/orderStatus';
import { useOrderStages } from '@/composables/useOrderStages';
import type { MenuOrder } from '@/api/menu/order/list';

// Status badge + picker. A tenant's own stages are offered inside their
// lifecycle group (any stage of the current group, and the stages of every group
// the order may move to); with no stages it is the plain seven-status picker.
const props = defineProps<{
  order: MenuOrder;
  statusLabel: (s: string) => string;
  updating?: boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{ (e: 'pick', status: string, stageId?: string): void }>();

const { byId, ofGroup } = useOrderStages();

const stage = computed(() => byId(props.order.stageId));
const badgeColor = computed(() => stage.value?.color || statusBadgeStyle(props.order.status).bg);
const badgeText = computed(() => stage.value?.name || props.statusLabel(props.order.status));
const icon = computed(() => statusBadgeStyle(props.order.status).icon);

interface Option { key: string; label: string; hint?: string; status: string; stageId?: string; color: string }

const options = computed<Option[]>(() => {
  const out: Option[] = [];
  const current = props.order.status;
  const targets = [current, ...nextStatuses(current, props.order.type)];
  for (const group of targets) {
    const stages = ofGroup(group);
    if (stages.length) {
      for (const s of stages) {
        if (group === current && s.id === props.order.stageId) continue;
        out.push({ key: s.id, label: s.name, hint: group === current ? undefined : props.statusLabel(group), status: group, stageId: s.id, color: s.color || statusBadgeStyle(group).bg });
      }
    } else if (group !== current) {
      out.push({ key: group, label: props.statusLabel(group), status: group, color: statusBadgeStyle(group).bg });
    }
  }
  return out;
});

// The current status first (checked), then the places the order can go.
const menuItems = computed(() => {
  const now = [{ label: badgeText.value, color: badgeColor.value, current: true, disabled: true }];
  const next = options.value.map((o) => ({ label: o.label, hint: o.hint, color: o.color, click: () => emit('pick', o.status, o.stageId) }));
  return next.length ? [now, next] : [now];
});
</script>

<template>
  <UDropdown
    :items="menuItems"
    :popper="{ placement: 'bottom-start', strategy: 'fixed' }"
    :disabled="updating || !options.length"
    :ui="{ width: 'w-64', rounded: 'rounded-2xl', padding: 'p-1.5', item: { padding: 'px-2.5 py-2', rounded: 'rounded-xl' } }"
  >
    <!-- One pill, chevron inside it: the whole thing is the button. -->
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1.5 rounded-full pl-2 pr-2 font-semibold text-white transition hover:brightness-110 disabled:cursor-default disabled:hover:brightness-100"
      :class="compact ? 'py-0.5 text-xs' : 'py-1.5 text-sm'"
      :style="{ backgroundColor: badgeColor }"
      :disabled="updating || !options.length"
      :aria-label="badgeText"
    >
      <Icon :name="icon" :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'" class="flex-shrink-0" />
      <span class="truncate">{{ badgeText }}</span>
      <Icon v-if="options.length || updating" :name="updating ? 'lucide:loader-2' : 'lucide:chevron-down'" class="h-3.5 w-3.5 flex-shrink-0 opacity-80" :class="{ 'animate-spin': updating }" />
    </button>
    <template #item="{ item }">
      <span class="flex w-full items-center gap-2.5">
        <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
        <span class="min-w-0 flex-1 truncate" :class="item.current ? 'font-semibold' : ''">{{ item.label }}</span>
        <Icon v-if="item.current" name="lucide:check" class="h-4 w-4 flex-shrink-0 text-gray-500" />
        <span v-else-if="item.hint" class="flex-shrink-0 text-[11px] text-gray-400">{{ item.hint }}</span>
      </span>
    </template>
  </UDropdown>
</template>
