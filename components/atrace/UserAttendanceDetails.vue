<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

const props = defineProps<{
  userId: string;
  username: string;
  startDate: string;
  endDate: string;
}>();

type DailyAttendance = {
  id: string;
  date: string;
  firstCheckIn: number; // unix timestamp
  lastCheckOut: number; // unix timestamp
  workedHours: number;
  requiredHours: number;
  attended: boolean;
  legitimate: boolean;
  reason?: string;
};

const attendanceRecords = ref<DailyAttendance[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = 10;
const totalRecords = ref(0);

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return attendanceRecords.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(attendanceRecords.value.length / itemsPerPage);
});

async function loadAttendanceDetails() {
  loading.value = true;
  error.value = null;
  
  try {
    console.log('[UserAttendanceDetails] Loading for userId:', props.userId, 'period:', props.startDate, '-', props.endDate);
    const { atraceGetAttendanceReport } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAttendanceReport(
      props.userId,
      props.startDate,
      props.endDate
    );
    console.log('[UserAttendanceDetails] Loaded', result.length, 'records:', result);
    attendanceRecords.value = result;
    totalRecords.value = result.length;
  } catch (e: any) {
    console.error('[UserAttendanceDetails] Failed to load attendance details:', e);
    error.value = t('app.failedToLoadDetails');
    attendanceRecords.value = [];
  } finally {
    loading.value = false;
  }
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp * 1000).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return '-';
  }
}

function formatDate(date: string): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return date;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

// Load data when component is mounted
onMounted(() => {
  console.log('[UserAttendanceDetails] Component mounted for user:', props.userId);
  loadAttendanceDetails();
});

// Reload when props change
watch(() => [props.userId, props.startDate, props.endDate], () => {
  console.log('[UserAttendanceDetails] Props changed, reloading...');
  currentPage.value = 1;
  loadAttendanceDetails();
});
</script>

<template>
  <div class="w-full">
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-blue-400 dark:text-blue-300" />
      <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">{{ t('app.loading') }}</span>
    </div>

    <div v-else-if="error" class="text-sm text-red-500 py-4">
      {{ error }}
    </div>

    <div v-else-if="attendanceRecords.length === 0" class="text-sm text-gray-500 py-4 text-center">
      {{ t('app.noAttendanceRecords') }}
    </div>

    <div v-else>
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th class="px-3 py-2 text-left font-medium">{{ t('app.date') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('app.checkIn') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('app.checkOut') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('app.hoursWorked') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('app.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="record in paginatedRecords" 
              :key="record.id"
              class="border-b dark:border-gray-700"
            >
              <td class="px-3 py-2">{{ formatDate(record.date) }}</td>
              <td class="px-3 py-2 text-center">{{ formatTime(record.firstCheckIn) }}</td>
              <td class="px-3 py-2 text-center">{{ formatTime(record.lastCheckOut) }}</td>
              <td class="px-3 py-2 text-center">
                <span class="font-medium">{{ record.workedHours.toFixed(1) }}{{ t('app.hoursShort') }}</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span 
                  v-if="record.attended"
                  class="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100"
                >
                  <UIcon name="i-heroicons-check-circle" class="w-3 h-3 mr-1" />
                  {{ t('app.attended') }}
                </span>
                <span 
                  v-else-if="record.legitimate"
                  class="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                  :title="record.reason"
                >
                  <UIcon name="i-heroicons-information-circle" class="w-3 h-3 mr-1" />
                  {{ t('app.excused') }}
                </span>
                <span 
                  v-else
                  class="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100"
                >
                  <UIcon name="i-heroicons-x-circle" class="w-3 h-3 mr-1" />
                  {{ t('app.violation') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm">
        <div class="text-gray-600 dark:text-gray-400">
          {{ t('app.showing') }} {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, totalRecords) }} {{ t('app.of') }} {{ totalRecords }}
        </div>
        <div class="flex gap-2">
          <UButton 
            size="xs" 
            variant="soft" 
            :disabled="currentPage === 1"
            @click="prevPage"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
          </UButton>
          <div class="flex items-center px-2">
            {{ currentPage }} / {{ totalPages }}
          </div>
          <UButton 
            size="xs" 
            variant="soft" 
            :disabled="currentPage === totalPages"
            @click="nextPage"
          >
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
