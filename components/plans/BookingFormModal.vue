<script lang="ts" setup>
// Unified "new booking" form used by the calendar (index.vue) and by
// click-to-create on an empty grid cell. Keeps the slot lookup and the
// nuxt/ui field markup in one place instead of re-implemented per call site.
import { useI18n } from '@/composables/useI18n';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import { plansApi, type PlansLocation, type PlansService, type PlansMaster, type PlansAvailableSlot } from '@/api/plans/ops';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  nsSlug: string;
  date: string;                       // YYYY-MM-DD (initial)
  locations: PlansLocation[];
  services: PlansService[];
  masters: PlansMaster[];
  preset?: { locationId?: string; masterId?: string; startAt?: string } | null;
  saving?: boolean;
}>(), { preset: null, saving: false });

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: any): void;
}>();

const { t } = useI18n();

const todayStr = new Date().toISOString().slice(0, 10);

const form = reactive({
  locationId: '', serviceId: '', masterId: '', slotStart: '',
  clientName: '', clientPhone: '', comment: '',
});
const pickedDate = ref(props.date);           // editable — book for any future day
const slots = ref<PlansAvailableSlot[]>([]);
const slotsLoading = ref(false);

const activeServices = computed(() => props.services.filter(s => s.isActive));
const mastersForForm = computed(() =>
  props.masters.filter(m => m.isActive && (!form.locationId || m.locationId === form.locationId)));
const selectedService = computed(() => props.services.find(s => s.id === form.serviceId) || null);

const locationOptions = computed(() => props.locations.map(l => ({ label: l.name, value: l.id })));
const serviceOptions = computed(() => activeServices.value.map(s => ({
  label: `${s.name} · ${s.durationMinutes} ${t('plans.min') || 'мин'}${s.price ? ` · ${s.price}` : ''}`,
  value: s.id,
})));
const masterOptions = computed(() => [
  { label: t('plans.anyMaster') || 'Любой доступный', value: '' },
  ...mastersForForm.value.map(m => ({ label: m.name, value: m.id })),
]);

const pickedDateLabel = computed(() =>
  new Date(pickedDate.value + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' }));

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function shiftDate(n: number) {
  const d = new Date(pickedDate.value + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const s = d.toISOString().slice(0, 10);
  if (s >= todayStr) pickedDate.value = s;
}

async function loadSlots() {
  slots.value = [];
  if (!form.locationId || !form.serviceId || !pickedDate.value) return;
  slotsLoading.value = true;
  try {
    slots.value = await plansApi.availableSlots(
      props.nsSlug, form.locationId, form.serviceId, pickedDate.value, form.masterId || undefined,
    );
    // keep a preset slot selected only if it survived the reload
    if (form.slotStart && !slots.value.some(s => s.startAt === form.slotStart)) form.slotStart = '';
  } catch { /* surfaced by caller toast on submit */ }
  finally { slotsLoading.value = false; }
}
watch(() => [form.locationId, form.serviceId, form.masterId, pickedDate.value], loadSlots);

watch(() => props.modelValue, (open) => {
  if (!open) return;
  const primary = props.locations.find(l => l.isPrimary)?.id || props.locations[0]?.id || '';
  form.locationId = props.preset?.locationId || primary;
  form.serviceId = activeServices.value[0]?.id || '';
  form.masterId = props.preset?.masterId || '';
  form.slotStart = props.preset?.startAt || '';
  form.clientName = ''; form.clientPhone = ''; form.comment = '';
  pickedDate.value = props.preset?.startAt ? props.preset.startAt.slice(0, 10) : props.date;
  slots.value = [];
  loadSlots();
});

const canSubmit = computed(() =>
  !!form.locationId && !!form.serviceId && !!form.slotStart
  && form.clientName.trim().length > 0 && form.clientPhone.trim().length > 0);

function submit() {
  if (!canSubmit.value) return;
  emit('submit', {
    locationId: form.locationId,
    masterId: form.masterId || null,
    clientName: form.clientName.trim(),
    clientPhone: form.clientPhone.trim(),
    startAt: form.slotStart,
    services: [{ serviceId: form.serviceId, masterId: form.masterId || null }],
    comment: form.comment.trim() || null,
  });
}
</script>

<template>
  <UModal :model-value="modelValue" :ui="{ width: 'sm:max-w-lg' }" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
      <template #header>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('plans.newBooking') || 'Новая запись' }}</h3>
      </template>

      <div class="space-y-3.5">
        <UFormGroup v-if="locations.length > 1" :label="t('plans.location') || 'Точка'">
          <USelectMenu v-model="form.locationId" :options="locationOptions" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <UFormGroup :label="t('plans.service') || 'Услуга'" required>
          <USelectMenu v-model="form.serviceId" :options="serviceOptions" value-attribute="value" option-attribute="label" :placeholder="t('plans.service') || 'Услуга'" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <UFormGroup :label="t('plans.master') || 'Мастер'">
          <USelectMenu v-model="form.masterId" :options="masterOptions" value-attribute="value" option-attribute="label" :disabled="selectedService?.requiresMaster && !mastersForForm.length" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <UFormGroup :label="t('plans.date') || 'Дата'" required>
          <div class="flex items-center gap-1.5">
            <UButton icon="lucide:chevron-left" size="xs" variant="soft" color="gray"
                     :disabled="pickedDate <= todayStr" @click="shiftDate(-1)" />
            <UInput type="date" v-model="pickedDate" :min="todayStr" class="flex-1" />
            <UButton icon="lucide:chevron-right" size="xs" variant="soft" color="gray" @click="shiftDate(1)" />
          </div>
          <p class="text-xs text-gray-400 mt-1 capitalize">{{ pickedDateLabel }}</p>
        </UFormGroup>

        <UFormGroup :label="t('plans.slot') || 'Свободное окно'" required>
          <div v-if="slotsLoading" class="py-2 text-sm text-gray-500 flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" /> {{ t('common.loading') || 'Загрузка…' }}
          </div>
          <div v-else-if="form.serviceId && !slots.length" class="py-2 text-sm text-gray-500">
            {{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}
          </div>
          <div v-else class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto -mx-0.5 px-0.5">
            <UButton
              v-for="s in slots" :key="s.startAt"
              size="xs" :variant="form.slotStart === s.startAt ? 'solid' : 'soft'"
              :color="form.slotStart === s.startAt ? 'primary' : 'gray'"
              @click="form.slotStart = s.startAt"
            >{{ fmtTime(s.startAt) }}</UButton>
          </div>
        </UFormGroup>

        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('plans.clientName') || 'Имя клиента'" required>
            <UInput v-model="form.clientName" icon="i-heroicons-user" @keyup.enter="submit" />
          </UFormGroup>
          <UFormGroup :label="t('plans.clientPhone') || 'Телефон'" required>
            <PhoneInput v-model="form.clientPhone" @enter="submit" />
          </UFormGroup>
        </div>

        <UFormGroup :label="t('plans.comment') || 'Комментарий'">
          <UTextarea v-model="form.comment" :rows="2" autoresize />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="emit('update:modelValue', false)">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton :loading="saving" :disabled="!canSubmit" @click="submit">{{ t('common.create') || 'Создать' }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
