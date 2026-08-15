<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { useAtraceLocationMap, TIMEZONES, getTimezoneLabel, type LocationForm } from '@/composables/useAtraceLocationMap';

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
    </div>
  </div>
</template>
