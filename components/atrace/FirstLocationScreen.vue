<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { useAtraceLocationMap, type LocationForm } from '@/composables/useAtraceLocationMap';
import { TIMEZONES, getTimezoneLabel } from '@/utils/timezones';

const TIMEZONES_FORMATTED = computed(() =>
  TIMEZONES.map(tz => ({
    value: tz.value,
    label: getTimezoneLabel(tz.value),
  }))
);

const props = defineProps<{
  modelValue: boolean
  // Set once the location form has been submitted and the post actually
  // exists -- switches this screen to the "scan to check in" step so
  // there's a live end-to-end test of the location just created, instead
  // of closing the moment the post exists but nobody has confirmed a scan
  // actually works. The QR fetch itself is owned and kicked off by the
  // caller (not a watcher in here): saving the first post changes
  // selectedPostId, which the page's tab-routing composable reacts to with
  // a same-route-record `router.push` that -- for reasons not fully
  // understood -- still remounts this component. A fetch started from a
  // watcher in here would get orphaned mid-flight by that remount and never
  // update anything; the caller's own state survives it via useState.
  createdPost?: { id: string; pin: string } | null
  checkinQrImage?: string | null
  checkinQrLoading?: boolean
  checkinQrError?: string
}>();
const form = defineModel<LocationForm>('form', { required: true });
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void,
  (e: 'submit'): void
}>();

const { t } = useI18n();

const {
  mapContainer, mapLoading, mapError, geoLoading, geoEnabled,
  handleGeolocationClick, activate, deactivate, generatePin,
} = useAtraceLocationMap(form);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && !props.createdPost) {
    activate();
  } else {
    deactivate();
  }
}, { immediate: true });

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      <div class="flex justify-end">
        <UButton color="gray" variant="ghost" size="sm" icon="lucide:x" :label="t('common.later') || 'Later'" @click="close" />
      </div>

      <template v-if="!createdPost">
      <div class="text-center mb-8">
        <div class="mx-auto mb-4 w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center">
          <Icon name="lucide:map-pin-plus" class="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('app.atraceFirstLocationTitle') || 'Add your first location' }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {{ t('app.atraceFirstLocationSubtitle') || "This is where attendance is tracked — your team checks in here, so let's set it up." }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormGroup :label="t('common.title')" required>
            <UInput v-model="form.title" size="lg" :placeholder="t('common.title')" autofocus />
          </UFormGroup>
          <UFormGroup :label="t('common.city')">
            <UInput v-model="form.location.city" size="lg" :placeholder="t('common.city')" />
          </UFormGroup>
        </div>

        <UFormGroup :label="t('common.description')">
          <UTextarea v-model="form.description" :placeholder="t('common.description')" />
        </UFormGroup>

        <UFormGroup :label="t('common.address')">
          <UInput v-model="form.location.address" size="lg" :placeholder="t('common.address')" />
        </UFormGroup>

        <UFormGroup :label="t('app.timezone')">
          <USelectMenu
            v-model="form.location.timezone"
            size="lg"
            :options="TIMEZONES_FORMATTED"
            option-attribute="label"
            value-attribute="value"
            searchable
            :placeholder="form.location.timezone || t('app.timezone')"
            :popper="{ strategy: 'fixed' }"
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ t('app.timezoneHint') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('app.location')">
          <div class="flex items-center gap-3 mb-2">
            <UToggle v-model="geoEnabled" />
            <span class="text-sm text-gray-700 dark:text-gray-200">
              {{ t('app.allowGeolocation') || 'Разрешить геолокацию' }}
            </span>
          </div>
          <div v-if="geoEnabled">
            <div
              ref="mapContainer"
              class="w-full h-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
            >
              <span v-if="mapLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</span>
              <span v-else-if="mapError" class="text-sm text-red-500">{{ mapError }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div v-if="form.location.latitude && form.location.longitude" class="text-xs text-gray-500">
                {{ Number(form.location.latitude).toFixed(6) }}, {{ Number(form.location.longitude).toFixed(6) }}
              </div>
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="lucide:map-pin"
                :loading="geoLoading"
                @click="handleGeolocationClick"
              >
                {{ t('app.allowGeolocation') || 'Разрешить геолокацию' }}
              </UButton>
            </div>
          </div>
        </UFormGroup>

        <div class="h-px bg-gray-100 dark:bg-gray-800" />

        <UFormGroup :label="t('app.pin6digits')">
          <div class="flex gap-2 items-center">
            <UInput v-model="form.pin" size="lg" maxlength="6" placeholder="******" class="w-32" />
            <UButton size="sm" color="primary" variant="soft" @click="generatePin">
              {{ t('common.generate') }}
            </UButton>
          </div>
          <div class="text-xs text-yellow-600 mt-1" v-html="t('app.pinSecurityNote')" />
        </UFormGroup>

        <div class="flex justify-end pt-1">
          <UButton
            size="lg"
            icon="lucide:check"
            color="primary"
            :disabled="!form.title || String(form.pin).length !== 6"
            @click="emit('submit')"
          >
            {{ t('app.atraceFirstLocationSubmit') || (t('common.create') as string) }}
          </UButton>
        </div>
      </div>
      </template>

      <template v-else>
      <div class="text-center mb-8">
        <div class="mx-auto mb-4 w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
          <Icon name="lucide:qr-code" class="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('app.atraceFirstCheckinTitle') || 'Location created' }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {{ t('app.atraceFirstCheckinSubtitle') || "Let's confirm it all works — make your first check-in." }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col items-center">
        <p class="text-sm text-gray-600 dark:text-gray-300 text-center max-w-sm mb-5">
          {{ t('app.atraceFirstCheckinInstruction') || 'Grab your phone camera and scan the QR code below to make your first check-in.' }}
        </p>

        <div
          class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 flex items-center justify-center"
          style="min-width:220px; min-height:220px;"
        >
          <img
            v-if="checkinQrImage"
            :src="checkinQrImage"
            alt="QR"
            class="checkin-qr-image w-full max-w-xs h-auto aspect-square object-contain"
            style="max-width:220px; min-width:180px;"
          >
          <div v-else-if="checkinQrLoading" class="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <Icon name="lucide:loader" class="w-8 h-8 animate-spin" />
            <span class="text-sm">{{ t('common.loading') }}</span>
          </div>
          <span v-else-if="checkinQrError" class="text-sm text-red-500 text-center max-w-[180px]">{{ checkinQrError }}</span>
          <span v-else class="text-sm text-gray-400 text-center max-w-[180px]">{{ t('common.loading') }}</span>
        </div>

        <div class="flex justify-center gap-3 pt-6 w-full">
          <UButton size="lg" color="gray" variant="soft" @click="close">
            {{ t('app.atraceFirstCheckinSkip') || 'Skip' }}
          </UButton>
          <UButton size="lg" icon="lucide:check" color="primary" @click="close">
            {{ t('app.atraceFirstCheckinDone') || 'Done' }}
          </UButton>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>
