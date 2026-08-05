<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import BranchLocationPicker from '@/components/menu/BranchLocationPicker.vue';
import { sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';
import { priorityIcon, priorityColorClass } from '@/utils/taskDisplay';
import type { TaskType } from '@/api/tasks/tasktype/list';

const { t } = useI18n();
const { user: currentUser } = useAuth();

// This modal only ever creates a new issue now -- editing an existing one
// happens inline in TaskDetailSlideover, in the same place it's viewed,
// rather than popping open a second, different-looking form.
const props = defineProps<{
  modelValue: boolean;
  taskTypes: TaskType[];
  memberOptions: { label: string; value: string }[];
  geoMapEnabled?: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  taskTypeId: '',
  title: '',
  description: '',
  priority: 0,
  assigneeUserId: '' as string,
  textAddress: '',
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
  clientNameSnapshot: '',
  clientPhoneSnapshot: '',
  dueAt: '',
  estimateValue: undefined as number | undefined,
});

const selectedTaskType = computed(() => props.taskTypes.find((tt) => tt.id === form.taskTypeId));
const estimateLabel = computed(() => {
  if (selectedTaskType.value?.estimationType === 'hours') return t('tasks.estimationHours') || 'Hours';
  if (selectedTaskType.value?.estimationType === 'story_points') return t('tasks.estimationStoryPoints') || 'Story points';
  return '';
});

// A quick "just capture the issue" flow shouldn't force contact/location
// fields on screen unless the board's Map & location module is on, or the
// issue type specifically requires a location.
const showContactSection = ref(false);

watch(() => props.modelValue, (open) => {
  if (!open) return;
  form.taskTypeId = props.taskTypes[0]?.id || '';
  form.title = '';
  form.description = '';
  form.priority = 1; // Medium -- a sane default rather than making everyone bump it up manually
  // Defaults to whoever's creating it -- the common case is "note this down
  // for myself", not leaving it unassigned.
  form.assigneeUserId = currentUser.value?.id || '';
  form.textAddress = '';
  form.lat = undefined;
  form.lng = undefined;
  form.clientNameSnapshot = '';
  form.clientPhoneSnapshot = '';
  form.dueAt = '';
  form.estimateValue = undefined;
  showContactSection.value = !!(props.geoMapEnabled || selectedTaskType.value?.requiresLocation);
}, { immediate: true });

watch(selectedTaskType, (tt) => {
  if (tt?.requiresLocation) showContactSection.value = true;
});

const phoneLooksInvalid = computed(() => !!form.clientPhoneSnapshot.trim() && !isPhoneInputValid(form.clientPhoneSnapshot.trim()));
function onPhoneInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = sanitizePhoneInput(target.value);
  if (target.value !== sanitized) target.value = sanitized;
  form.clientPhoneSnapshot = sanitized;
}

const priorityOptions = computed(() => [
  { label: t('tasks.priorityLow') || 'Low', value: 0 },
  { label: t('tasks.priorityMedium') || 'Medium', value: 1 },
  { label: t('tasks.priorityHigh') || 'High', value: 2 },
  { label: t('tasks.priorityUrgent') || 'Urgent', value: 3 },
]);

const isFormValid = computed(() => form.title.trim().length > 0 && !!form.taskTypeId && !phoneLooksInvalid.value);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    taskTypeId: form.taskTypeId,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority,
    assigneeUserId: form.assigneeUserId || undefined,
    textAddress: form.textAddress.trim() || undefined,
    lat: form.lat,
    lng: form.lng,
    clientNameSnapshot: form.clientNameSnapshot.trim() || undefined,
    clientPhoneSnapshot: form.clientPhoneSnapshot.trim() || undefined,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
    estimateValue: estimateLabel.value ? form.estimateValue : undefined,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose" :ui="{ width: 'sm:max-w-xl' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('tasks.createTask') || 'Create issue' }}</h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('tasks.taskTitle') || 'Title'" required>
          <UInput v-model="form.title" size="lg" autofocus :placeholder="t('tasks.taskTitlePlaceholder') || 'What needs to be done?'" @keyup.enter="handleSubmit" />
        </UFormGroup>

        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('tasks.taskType') || 'Issue type'" required>
            <USelectMenu
              v-model="form.taskTypeId"
              :options="taskTypes.map((tt) => ({ label: tt.name, value: tt.id, icon: tt.icon }))"
              value-attribute="value"
              option-attribute="label"
              :popper="{ strategy: 'fixed' }"
            >
              <template #label>
                <UIcon :name="selectedTaskType?.icon || 'lucide:shapes'" class="w-4 h-4" />
                <span>{{ selectedTaskType?.name }}</span>
              </template>
              <template #option="{ option }">
                <UIcon :name="option.icon || 'lucide:shapes'" class="w-4 h-4" />
                <span>{{ option.label }}</span>
              </template>
            </USelectMenu>
          </UFormGroup>
          <UFormGroup :label="t('tasks.priority') || 'Priority'">
            <USelectMenu
              v-model="form.priority"
              :options="priorityOptions"
              value-attribute="value"
              option-attribute="label"
              :popper="{ strategy: 'fixed' }"
            >
              <template #label>
                <UIcon :name="priorityIcon(form.priority)" :class="['w-4 h-4', priorityColorClass(form.priority)]" />
                <span>{{ priorityOptions.find((p) => p.value === form.priority)?.label }}</span>
              </template>
              <template #option="{ option }">
                <UIcon :name="priorityIcon(option.value)" :class="['w-4 h-4', priorityColorClass(option.value)]" />
                <span>{{ option.label }}</span>
              </template>
            </USelectMenu>
          </UFormGroup>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('tasks.assignee') || 'Assignee'">
            <USelectMenu
              v-model="form.assigneeUserId"
              :options="[{ label: t('tasks.unassigned') || 'Unassigned', value: '' }, ...memberOptions]"
              value-attribute="value"
              option-attribute="label"
              searchable
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
          <UFormGroup :label="t('tasks.dueAt') || 'Due date'">
            <UInput v-model="form.dueAt" type="datetime-local" size="lg" />
          </UFormGroup>
        </div>

        <UFormGroup v-if="estimateLabel" :label="`${t('tasks.estimateValue') || 'Estimate'} (${estimateLabel})`">
          <UInput v-model.number="form.estimateValue" type="number" min="0" step="0.5" size="lg" class="w-32" />
        </UFormGroup>

        <UFormGroup :label="t('tasks.description') || 'Description'" :hint="t('tasks.markdownSupported') || 'Markdown supported'">
          <UTextarea v-model="form.description" :rows="2" autoresize resize :placeholder="t('tasks.descriptionPlaceholder') || 'Optional details...'" />
        </UFormGroup>

        <div class="pt-1 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-3 mb-1"
            @click="showContactSection = !showContactSection"
          >
            <UIcon name="lucide:contact" class="w-3.5 h-3.5" />
            {{ t('tasks.client') || 'Contact' }}
            <UIcon :name="showContactSection ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="w-3.5 h-3.5" />
          </button>

          <div v-if="showContactSection" class="space-y-3 pt-2">
            <div class="grid grid-cols-2 gap-3">
              <UFormGroup :label="t('tasks.clientName') || 'Contact name'">
                <UInput v-model="form.clientNameSnapshot" size="lg" />
              </UFormGroup>
              <UFormGroup :label="t('tasks.clientPhone') || 'Contact phone'" :error="phoneLooksInvalid" :help="phoneLooksInvalid ? (t('contacts.invalidPhone') || 'Invalid phone format') : ''">
                <UInput :model-value="form.clientPhoneSnapshot" type="tel" size="lg" placeholder="+7 700 123 45 67" @input="onPhoneInput" />
              </UFormGroup>
            </div>
            <UFormGroup :label="t('tasks.address') || 'Contact address'">
              <UInput v-model="form.textAddress" size="lg" :placeholder="t('tasks.addressPlaceholder') || 'Free-text address'" />
            </UFormGroup>
            <UFormGroup
              :label="t('tasks.mapPin') || 'Map pin (optional)'"
              :hint="t('tasks.mapPinHint') || 'Independent from the address above — set both if you have them'"
            >
              <ClientOnly>
                <BranchLocationPicker :lat="form.lat" :lng="form.lng" @update="(lat: number, lng: number) => { form.lat = lat; form.lng = lng; }" />
              </ClientOnly>
            </UFormGroup>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="!isFormValid || saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
