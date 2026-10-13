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
</script>

<template>
  <UDropdown :items="[options.map((o) => ({ label: o.label, click: () => emit('pick', o.status, o.stageId), opt: o }))]" :popper="{ placement: 'bottom-start' }">
    <button type="button" class="inline-flex items-center gap-1.5 rounded-full disabled:opacity-50" :disabled="updating || !options.length">
      <span
        class="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-white text-xs font-semibold"
        :style="{ backgroundColor: badgeColor, boxShadow: `0 0 0 4px ${badgeColor}33` }"
      >
        <Icon :name="icon" class="w-3.5 h-3.5" />
        {{ badgeText }}
      </span>
      <Icon v-if="options.length" :name="updating ? 'lucide:loader-2' : 'lucide:chevron-down'" class="w-3.5 h-3.5 text-gray-400" :class="{ 'animate-spin': updating }" />
    </button>
    <template #item="{ item }">
      <span class="flex items-center gap-2 w-full">
        <span class="h-2 w-2 rounded-full flex-shrink-0" :style="{ backgroundColor: item.opt.color }" />
        <span class="truncate">{{ item.label }}</span>
        <span v-if="item.opt.hint" class="ml-auto text-[11px] text-gray-400">{{ item.opt.hint }}</span>
      </span>
    </template>
  </UDropdown>
</template>
