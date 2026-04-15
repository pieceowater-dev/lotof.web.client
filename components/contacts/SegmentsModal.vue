<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '#imports';
import type { Segment, SegmentRule } from '@/api/contacts/segments';
import { 
  listSegments, 
  getSegmentRules,
  createSegment, 
  updateSegment, 
  deleteSegment,
  createSegmentRule,
  deleteSegmentRule
} from '@/api/contacts/segments';

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'segmentCreated', segment: Segment): void;
}>();

const segments = ref<Segment[]>([]);
const selectedSegment = ref<Segment | null>(null);
const segmentRules = ref<SegmentRule[]>([]);
const loading = ref(false);
const isCreating = ref(false);
const newSegmentName = ref('');

async function loadSegments() {
  if (!token.value) return;
  try {
    loading.value = true;
    const response = await listSegments(token.value);
    segments.value = response.segments?.rows || [];
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to load segments',
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function loadSegmentRules(segmentId: string) {
  if (!token.value) return;
  try {
    const response = await getSegmentRules(token.value, segmentId);
    segmentRules.value = response.segmentRules?.rows || [];
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to load segment rules',
      color: 'red',
    });
  }
}

async function handleCreateSegment() {
  if (!newSegmentName.value.trim() || !token.value) return;
  
  try {
    isCreating.value = true;
    const newSegment = await createSegment(token.value, newSegmentName.value.trim(), 'system');
    segments.value.push(newSegment.createSegment);
    newSegmentName.value = '';
    emit('segmentCreated', newSegment.createSegment);
    toast.add({
      title: t('common.success'),
      description: 'Segment created successfully',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to create segment',
      color: 'red',
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleDeleteSegment(id: string) {
  if (!token.value) return;
  try {
    await deleteSegment(token.value, id);
    segments.value = segments.value.filter(s => s.id !== id);
    if (selectedSegment.value?.id === id) {
      selectedSegment.value = null;
      segmentRules.value = [];
    }
    toast.add({
      title: t('common.success'),
      description: 'Segment deleted successfully',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to delete segment',
      color: 'red',
    });
  }
}

function selectSegment(segment: Segment) {
  selectedSegment.value = segment;
  loadSegmentRules(segment.id);
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadSegments();
  }
});
</script>

<template>
  <UModal
    :model-value="isOpen"
    title="Manage Segments"
    @update:model-value="$emit('close')"
  >
    <div class="p-4 space-y-4">
      <!-- Create new segment -->
      <div class="flex gap-2">
        <UInput
          v-model="newSegmentName"
          placeholder="New segment name..."
          size="sm"
          @keyup.enter="handleCreateSegment"
        />
        <UButton
          :loading="isCreating"
          size="sm"
          @click="handleCreateSegment"
        >
          {{ t('common.add') }}
        </UButton>
      </div>

      <div class="grid grid-cols-2 gap-4 min-h-[400px]">
        <!-- Segments list -->
        <div class="space-y-2">
          <h3 class="text-sm font-semibold">
            Segments
          </h3>
          <div
            v-if="loading"
            class="flex justify-center py-8"
          >
            <UIcon
              name="lucide:loader"
              class="w-6 h-6 animate-spin text-gray-400"
            />
          </div>
          <div
            v-else
            class="space-y-1 max-h-[350px] overflow-y-auto"
          >
            <div
              v-for="segment in segments"
              :key="segment.id"
              :class="[
                'p-2 rounded cursor-pointer text-sm transition-colors',
                selectedSegment?.id === segment.id
                  ? 'bg-emerald-100 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              ]"
              @click="selectSegment(segment)"
            >
              <div class="flex items-center justify-between">
                <span>{{ segment.name }}</span>
                <UButton
                  size="xs"
                  color="red"
                  variant="ghost"
                  icon="lucide:trash-2"
                  @click.stop="handleDeleteSegment(segment.id)"
                />
              </div>
            </div>

            <div
              v-if="!loading && segments.length === 0"
              class="text-center py-8 text-gray-500 text-sm"
            >
              No segments yet
            </div>
          </div>
        </div>

        <!-- Segment rules -->
        <div class="space-y-2">
          <h3 class="text-sm font-semibold">
            Rules
          </h3>
          <div
            v-if="selectedSegment"
            class="space-y-2 max-h-[350px] overflow-y-auto"
          >
            <div
              v-for="rule in segmentRules"
              :key="rule.id"
              class="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">
                    {{ rule.fieldKey }}
                  </div>
                  <div class="text-gray-600 dark:text-gray-400">
                    {{ rule.operator }} {{ rule.value }}
                  </div>
                </div>
                <UButton
                  size="xs"
                  color="red"
                  variant="ghost"
                  icon="lucide:trash-2"
                  @click="token && deleteSegmentRule(token, rule.id)"
                />
              </div>
            </div>

            <div
              v-if="segmentRules.length === 0"
              class="text-center py-8 text-gray-500 text-sm"
            >
              No rules for this segment
            </div>
          </div>
          <div
            v-else
            class="text-center py-8 text-gray-500 text-sm"
          >
            Select a segment to view rules
          </div>
        </div>
      </div>
    </div>
  </UModal>
</template>
