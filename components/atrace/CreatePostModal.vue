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
}>();
const form = defineModel<LocationForm>('form', { required: true });
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void,
  (e: 'submit'): void
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const { t } = useI18n();

const {
  mapContainer, mapLoading, mapError, geoLoading, geoEnabled,
  handleGeolocationClick, activate, deactivate, generatePin,
} = useAtraceLocationMap(form);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    activate();
  } else {
    deactivate();
  }
});
</script>

<template>
  <UModal v-model="open">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('app.atraceAddLocation') }}
          </h3>
          <UButton
            color="primary"
            variant="ghost"
            icon="lucide:x"
            class="-my-1"
            @click="open = false"
          />
        </div>
      </template>

      <div class="space-y-3">
        <UFormGroup :label="t('common.title')">
          <UInput
            v-model="form.title"
            :placeholder="t('common.title')"
          />
        </UFormGroup>
        <UFormGroup :label="t('common.description')">
          <UTextarea
            v-model="form.description"
            :placeholder="t('common.description')"
          />
        </UFormGroup>
        <div class="h-px bg-gray-100 dark:bg-gray-800" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormGroup :label="t('common.address')">
            <UInput
              v-model="form.location.address"
              :placeholder="t('common.address')"
            />
          </UFormGroup>
          <UFormGroup :label="t('common.city')">
            <UInput
              v-model="form.location.city"
              :placeholder="t('common.city')"
            />
          </UFormGroup>
        </div>

        <UFormGroup :label="t('app.timezone')">
          <USelectMenu
            v-model="form.location.timezone"
            :options="TIMEZONES_FORMATTED"
            option-attribute="label"
            value-attribute="value"
            searchable
            :placeholder="form.location.timezone || t('app.timezone')"
            :popper="{ placement: 'top' }"
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ t('app.timezoneHint') }}
          </div>
        </UFormGroup>

        <!-- Google Map -->
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
              class="w-full h-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
            >
              <span
                v-if="mapLoading"
                class="text-sm text-gray-500"
              >{{ t('common.loading') }}</span>
              <span
                v-else-if="mapError"
                class="text-sm text-red-500"
              >{{ mapError }}</span>
            </div>
            <div class="flex items-center justify-between mt-1">
              <div
                v-if="form.location.latitude && form.location.longitude"
                class="text-xs text-gray-500"
              >
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
            <div
              v-if="form.location.latitude && form.location.longitude"
              class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800"
            >
              <UToggle v-model="form.location.requireGeoOnCheckIn" />
              <span class="text-sm text-gray-700 dark:text-gray-200">
                {{ t('app.requireGeoOnCheckIn') || 'Требовать геолокацию при отметке' }}
              </span>
            </div>
          </div>
        </UFormGroup>

        <div class="h-px bg-gray-100 dark:bg-gray-800" />
        <UFormGroup :label="t('app.pin6digits')">
          <div class="flex gap-2 items-center">
            <UInput
              v-model="form.pin"
              maxlength="6"
              placeholder="******"
              class="w-32"
            />
            <UButton
              size="xs"
              color="primary"
              @click="generatePin"
            >
              {{ t('common.generate') }}
            </UButton>
          </div>
          <div
            class="text-xs text-yellow-600 mt-1"
            v-html="t('app.pinSecurityNote')"
          />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            icon="lucide:x"
            color="primary"
            variant="soft"
            @click="open = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            icon="lucide:check"
            color="primary"
            :disabled="!form.title || String(form.pin).length !== 6"
            @click="emit('submit')"
          >
            {{ t('common.create') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
