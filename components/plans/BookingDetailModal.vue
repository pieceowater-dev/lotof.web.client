<script lang="ts" setup>
// Booking detail + quick actions, shown as a narrow iOS-style bottom sheet.
// View mode: read-only summary + status flow. Edit mode: name / phone /
// comment inline, plus a reschedule sub-panel for date + master.
import { useI18n } from '@/composables/useI18n';
import { plansApi, type PlansBooking, type PlansMaster, type PlansAvailableSlot } from '@/api/plans/ops';
import PhoneInput from '@/components/ui/PhoneInput.vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  nsSlug: string;
  booking: PlansBooking | null;
  master: PlansMaster | null;
  masters?: PlansMaster[];
  serviceName?: string;
  canManage: boolean;        // create / reschedule / edit fields
  canSetStatus?: boolean;    // change the booking's status (a master may, for their clients)
}>(), { canSetStatus: undefined, masters: () => [] });

const maySetStatus = computed(() => props.canSetStatus ?? props.canManage);

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'changed'): void;
}>();

const { t } = useI18n();
const toast = useToast();

// A plain centred dialog — narrow, content-height, scrolls internally past
// ~80vh. (USlideover's flex-1 base fights every width/height override for a
// bottom sheet, which is why it kept coming out full-width and stretched.)
const sheetUi = { width: 'sm:max-w-lg' };

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW: { label: t('plans.statusNew') || 'Новая', color: 'blue' },
  CONFIRMED: { label: t('plans.statusConfirmed') || 'Подтверждена', color: 'primary' },
  COMPLETED: { label: t('plans.statusCompleted') || 'Завершена', color: 'emerald' },
  CANCELLED: { label: t('plans.statusCancelled') || 'Отменена', color: 'red' },
  NO_SHOW: { label: t('plans.statusNoShow') || 'Не пришёл', color: 'amber' },
};
function nextStatuses(s: string): string[] {
  if (s === 'NEW') return ['CONFIRMED', 'CANCELLED'];
  if (s === 'CONFIRMED') return ['COMPLETED', 'NO_SHOW', 'CANCELLED'];
  return [];
}

const busy = ref(false);
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'long' }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }

const masterOptions = computed(() => {
  const list = props.masters.length ? props.masters : (props.master ? [props.master] : []);
  return [{ label: t('plans.anyMaster') || 'Без мастера', value: '' }, ...list.map(m => ({ label: m.name, value: m.id }))];
});

async function setStatus(status: string) {
  if (!props.booking) return;
  busy.value = true;
  try {
    await plansApi.updateBookingStatus(props.nsSlug, props.booking.id, status);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
    emit('changed');
    emit('update:modelValue', false);
  } catch (e: any) {
    toast.add({ title: t('common.error') || 'Ошибка', description: e?.message, color: 'red' });
  } finally { busy.value = false; }
}

// --- edit (name / phone / comment) ---
const editMode = ref(false);
const editForm = reactive({ name: '', phone: '', comment: '' });
function openEdit() {
  if (!props.booking) return;
  editForm.name = props.booking.clientName || '';
  editForm.phone = props.booking.clientPhone || '';
  editForm.comment = props.booking.comment || '';
  editMode.value = true;
}
async function saveEdit() {
  if (!props.booking || !editForm.name.trim() || !editForm.phone.trim()) return;
  busy.value = true;
  try {
    await plansApi.updateBooking(props.nsSlug, props.booking.id, editForm.name.trim(), editForm.phone.trim(), editForm.comment.trim() || null);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
    emit('changed');
    editMode.value = false;
    emit('update:modelValue', false);
  } catch (e: any) {
    toast.add({ title: t('common.error') || 'Ошибка', description: e?.message, color: 'red' });
  } finally { busy.value = false; }
}

// --- reschedule (date + master + slot) ---
const reMode = ref(false);
const reDate = ref('');
const reMaster = ref('');
const reSlots = ref<PlansAvailableSlot[]>([]);
const reSlot = ref('');
const reLoading = ref(false);

function openReschedule() {
  if (!props.booking) return;
  reMode.value = true;
  reDate.value = props.booking.startAt.slice(0, 10);
  reMaster.value = props.booking.masterId || '';
  reSlot.value = '';
  loadReSlots();
}
async function loadReSlots() {
  if (!props.booking) return;
  reLoading.value = true;
  try {
    const lines = await plansApi.bookingServices(props.nsSlug, props.booking.id);
    const svcId = lines[0]?.serviceId;
    if (!svcId) { reSlots.value = []; return; }
    reSlots.value = await plansApi.availableSlots(props.nsSlug, props.booking.locationId, svcId, reDate.value, reMaster.value || undefined);
  } catch { reSlots.value = []; }
  finally { reLoading.value = false; }
}
watch([reDate, reMaster], () => { if (reMode.value) loadReSlots(); });

async function confirmReschedule() {
  if (!props.booking || !reSlot.value) return;
  busy.value = true;
  try {
    await plansApi.rescheduleBooking(props.nsSlug, props.booking.id, reSlot.value, reMaster.value || undefined);
    toast.add({ title: t('plans.rescheduled') || 'Запись перенесена', color: 'emerald' });
    emit('changed');
    emit('update:modelValue', false);
  } catch (e: any) {
    toast.add({ title: t('common.error') || 'Ошибка', description: e?.message, color: 'red' });
  } finally { busy.value = false; reMode.value = false; }
}

watch(() => props.modelValue, (o) => { if (!o) { reMode.value = false; editMode.value = false; } });
</script>

<template>
  <UModal
    :model-value="modelValue"
    :ui="sheetUi"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="booking" class="flex flex-col max-h-[85vh]">
      <!-- header -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <span class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
              :style="{ background: master?.color || '#7c3aed' }">
          {{ (booking.clientName || '?').slice(0, 1).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
            {{ editMode ? (t('plans.editBooking') || 'Изменить запись') : booking.clientName }}
          </h3>
          <a v-if="!editMode" :href="`tel:${booking.clientPhone}`" class="text-sm text-primary-600 dark:text-primary-400 hover:underline tabular-nums">{{ booking.clientPhone }}</a>
        </div>
        <UBadge :color="(STATUS_META[booking.status]?.color as any) || 'gray'" variant="subtle" class="flex-shrink-0">
          {{ STATUS_META[booking.status]?.label || booking.status }}
        </UBadge>
        <UButton icon="lucide:x" size="xs" variant="ghost" color="gray" class="flex-shrink-0" @click="emit('update:modelValue', false)" />
      </div>

      <!-- body -->
      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <!-- EDIT MODE: client fields -->
        <div v-if="editMode" class="space-y-3">
          <UFormGroup :label="t('plans.clientName') || 'Имя клиента'">
            <UInput v-model="editForm.name" size="md" icon="i-heroicons-user" />
          </UFormGroup>
          <UFormGroup :label="t('plans.phone') || 'Телефон'">
            <PhoneInput v-model="editForm.phone" size="md" />
          </UFormGroup>
          <UFormGroup :label="t('plans.comment') || 'Комментарий'">
            <UTextarea v-model="editForm.comment" :rows="2" autoresize />
          </UFormGroup>
          <button type="button" class="text-xs text-primary-600 dark:text-primary-400 inline-flex items-center gap-1" @click="openReschedule">
            <UIcon name="lucide:calendar-clock" class="w-3.5 h-3.5" />
            {{ t('plans.changeDateMaster') || 'Изменить дату / мастера' }}
          </button>
        </div>

        <!-- VIEW MODE: summary -->
        <div v-else class="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-gray-800">
          <div class="flex items-start gap-3 px-3.5 py-3">
            <UIcon name="lucide:calendar" class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-xs text-gray-400">{{ t('plans.when') || 'Когда' }}</div>
              <div class="text-sm text-gray-900 dark:text-gray-100 capitalize">{{ fmtDate(booking.startAt) }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{{ fmtTime(booking.startAt) }} – {{ fmtTime(booking.endAt) }}</div>
            </div>
          </div>
          <div class="flex items-center gap-3 px-3.5 py-3">
            <UIcon name="lucide:user" class="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-400">{{ t('plans.master') || 'Мастер' }}</div>
              <div class="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span v-if="master" class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: master.color || '#7c3aed' }" />
                {{ master?.name || (t('plans.anyMaster') || 'Без мастера') }}
              </div>
            </div>
          </div>
          <div v-if="serviceName" class="flex items-center gap-3 px-3.5 py-3">
            <UIcon name="lucide:scissors" class="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-400">{{ t('plans.service') || 'Услуга' }}</div>
              <div class="text-sm text-gray-900 dark:text-gray-100">{{ serviceName }}</div>
            </div>
            <span v-if="booking.totalPrice" class="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums flex-shrink-0">{{ booking.totalPrice }}</span>
          </div>
          <div v-if="booking.comment" class="flex items-start gap-3 px-3.5 py-3">
            <UIcon name="lucide:message-square" class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-xs text-gray-400">{{ t('plans.comment') || 'Комментарий' }}</div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ booking.comment }}</div>
            </div>
          </div>
          <div v-if="booking.cancellationReason" class="flex items-start gap-3 px-3.5 py-3">
            <UIcon name="lucide:x-circle" class="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-xs text-red-400">{{ t('plans.cancelReason') || 'Причина отмены' }}</div>
              <div class="text-sm text-red-600 dark:text-red-400">{{ booking.cancellationReason }}</div>
            </div>
          </div>
        </div>

        <!-- reschedule sub-panel -->
        <div v-if="reMode" class="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.reschedule') || 'Перенести' }}</h4>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('plans.date') || 'Дата'">
              <UInput v-model="reDate" type="date" size="sm" :min="new Date().toISOString().slice(0,10)" />
            </UFormGroup>
            <UFormGroup :label="t('plans.master') || 'Мастер'">
              <USelectMenu
                v-model="reMaster" size="sm"
                :options="masterOptions"
                value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>
          <div v-if="reLoading" class="text-sm text-gray-500 py-1">{{ t('common.loading') || 'Загрузка…' }}</div>
          <div v-else-if="!reSlots.length" class="text-sm text-gray-500 py-1">{{ t('plans.noSlotsDay') || 'Свободных окон нет' }}</div>
          <div v-else class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            <UButton v-for="s in reSlots" :key="s.startAt" size="xs"
                     :variant="reSlot === s.startAt ? 'solid' : 'soft'" :color="reSlot === s.startAt ? 'primary' : 'gray'"
                     @click="reSlot = s.startAt">{{ fmtTime(s.startAt) }}</UButton>
          </div>
          <div class="flex justify-end gap-2">
            <UButton size="xs" variant="ghost" color="gray" @click="reMode = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton size="xs" :loading="busy" :disabled="!reSlot" @click="confirmReschedule">{{ t('plans.moveHere') || 'Перенести' }}</UButton>
          </div>
        </div>
      </div>

      <!-- footer actions -->
      <div v-if="editMode" class="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
        <UButton size="sm" variant="ghost" color="gray" @click="editMode = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
        <UButton size="sm" :loading="busy" :disabled="!editForm.name.trim() || !editForm.phone.trim()" @click="saveEdit">
          {{ t('common.save') || 'Сохранить' }}
        </UButton>
      </div>
      <div v-else-if="(maySetStatus || canManage) && !reMode" class="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-2">
        <template v-if="maySetStatus">
          <UButton
            v-for="s in nextStatuses(booking.status)" :key="s"
            size="sm" variant="soft" :color="(STATUS_META[s]?.color as any) || 'gray'"
            :loading="busy" @click="setStatus(s)"
          >{{ STATUS_META[s]?.label || s }}</UButton>
        </template>
        <span class="flex-1" />
        <UButton
          v-if="canManage"
          size="sm" variant="ghost" color="gray" icon="lucide:pencil" @click="openEdit"
        >{{ t('common.edit') || 'Изменить' }}</UButton>
        <UButton
          v-if="canManage && (booking.status === 'NEW' || booking.status === 'CONFIRMED')"
          size="sm" variant="ghost" color="gray" icon="lucide:calendar-clock" @click="openReschedule"
        >{{ t('plans.reschedule') || 'Перенести' }}</UButton>
      </div>
    </div>
  </UModal>
</template>
