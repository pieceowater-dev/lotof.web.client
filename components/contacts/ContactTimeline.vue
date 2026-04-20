<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientEvent } from '@/api/contacts/events';
import { getEventIcon, parseEventPayload } from '@/api/contacts/events';

interface Props {
  events: ClientEvent[];
  tagNameById?: Record<string, string>;
  dynamicFieldNameById?: Record<string, string>;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasMore: false,
  loadingMore: false,
  tagNameById: () => ({}),
  dynamicFieldNameById: () => ({}),
});

const emit = defineEmits<{
  (e: 'load-more'): void;
}>();

const timelineScrollRef = ref<HTMLElement | null>(null);
const isTimelineAtTop = ref(true);
const { t, locale } = useI18n();

const hiddenTimelineFields = new Set(['full_name', 'full_name_norm']);
const hiddenTimelineEvents = new Set(['identity_primary_set']);

function normalizeTimelineFieldKey(rawKey: string): string {
  return String(rawKey || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function isSystemTimelineField(normalizedKey: string): boolean {
  return normalizedKey === 'id' || normalizedKey.endsWith('_id') || normalizedKey.endsWith('_at');
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function toIdentityTypeLabel(rawValue: unknown): string {
  const normalized = String(rawValue ?? '').trim().toLowerCase();

  switch (normalized) {
  case "1":
  case "phone":
    return t('contacts.timelineIdentityTypePhone');
  case "2":
  case "email":
    return t('contacts.timelineIdentityTypeEmail');
  case "3":
  case "telegram":
    return t('contacts.timelineIdentityTypeTelegram');
  case "4":
  case "whatsapp":
    return t('contacts.timelineIdentityTypeWhatsapp');
  case "5":
  case "company":
    return t('contacts.timelineIdentityTypeCompany');
  case "6":
  case "contact_person":
    return t('contacts.timelineIdentityTypeContactPerson');
  default:
    return String(rawValue ?? '');
  }
}

function readStateValue(state: Record<string, any>, aliases: string[]): any {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(state || {}, alias)) {
      return (state as any)[alias];
    }
  }
  return undefined;
}

function buildIdentityChanges(beforeState: Record<string, any>, afterState: Record<string, any>) {
  const descriptor = [
    { key: 'type', aliases: ['type', 'Type'], transform: (v: unknown) => toIdentityTypeLabel(v) },
    { key: 'value', aliases: ['value', 'Value'] },
    { key: 'is_primary', aliases: ['is_primary', 'isPrimary', 'IsPrimary'], transform: (v: unknown) => v },
    { key: 'comments', aliases: ['comments', 'Comments'] },
  ];

  const changes: Array<{ key: string; label?: string; before?: any; after?: any }> = [];
  for (const item of descriptor) {
    const beforeRaw = readStateValue(beforeState, item.aliases);
    const afterRaw = readStateValue(afterState, item.aliases);

    if (isEmptyValue(beforeRaw) && isEmptyValue(afterRaw)) {
      continue;
    }

    const beforeValue = item.transform ? item.transform(beforeRaw) : beforeRaw;
    const afterValue = item.transform ? item.transform(afterRaw) : afterRaw;
    if (beforeValue === afterValue) {
      continue;
    }

    changes.push({
      key: item.key,
      before: beforeValue,
      after: afterValue,
    });
  }

  return changes;
}

function resolveTagNameByID(rawID: unknown): string {
  const tagID = String(rawID || '').trim();
  if (!tagID) {
    return '';
  }
  return props.tagNameById?.[tagID] || t('contacts.timelineUnknownTag');
}

function extractTagID(state: Record<string, any>): string {
  const candidates = ['tag_id', 'TagID', 'tagId'];
  for (const key of candidates) {
    const value = state?.[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return '';
}

function extractDynamicFieldID(payload: Record<string, any>, beforeState: Record<string, any>, afterState: Record<string, any>): string {
  const candidates: unknown[] = [
    payload?.field_id,
    payload?.fieldId,
    beforeState?.FieldID,
    beforeState?.field_id,
    beforeState?.fieldId,
    afterState?.FieldID,
    afterState?.field_id,
    afterState?.fieldId,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function resolveDynamicFieldNameByID(fieldID: string): string {
  if (!fieldID) {
    return t('contacts.timelineUnknownField');
  }

  return props.dynamicFieldNameById?.[fieldID] || t('contacts.timelineUnknownField');
}

function pickStateValue(state: Record<string, any>, candidates: string[]): any {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(state || {}, key)) {
      return (state as any)[key];
    }
  }
  return undefined;
}

function buildDynamicFieldValueChanges(
  payload: Record<string, any>,
  beforeState: Record<string, any>,
  afterState: Record<string, any>,
): Array<{ key: string; label?: string; before?: any; after?: any }> {
  const fieldID = extractDynamicFieldID(payload, beforeState, afterState);
  const fieldName = resolveDynamicFieldNameByID(fieldID);

  const valueCandidates: Array<{ key: string; aliases: string[] }> = [
    { key: 'value_bool', aliases: ['value_bool', 'ValueBool', 'valueBool'] },
    { key: 'value_date', aliases: ['value_date', 'ValueDate', 'valueDate'] },
    { key: 'value_json', aliases: ['value_json', 'ValueJSON', 'valueJson'] },
    { key: 'value_number', aliases: ['value_number', 'ValueNumber', 'valueNumber'] },
    { key: 'value_string', aliases: ['value_string', 'ValueString', 'valueString'] },
  ];

  for (const candidate of valueCandidates) {
    const beforeValue = pickStateValue(beforeState, candidate.aliases);
    const afterValue = pickStateValue(afterState, candidate.aliases);

    if (isEmptyValue(beforeValue) && isEmptyValue(afterValue)) {
      continue;
    }
    if (beforeValue === afterValue) {
      continue;
    }

    return [{
      key: candidate.key,
      label: fieldName,
      before: beforeValue,
      after: afterValue,
    }];
  }

  return [];
}

type TimelineItem = {
  id: string;
  createdAt: string;
  icon: string;
  title: string;
  changes: Array<{ key: string; label?: string; before?: any; after?: any }>;
};

type TimelineChange = { key: string; label?: string; before?: any; after?: any };

type TimelineGroup = {
  dayKey: string;
  title: string;
  items: TimelineItem[];
};

const timelineItems = computed<TimelineItem[]>(() => {
  return (props.events || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((event) => {
      const payload = parseEventPayload(event.payload);
      const eventName = String(payload.name || event.eventType || '').toLowerCase();
      if (hiddenTimelineEvents.has(eventName)) {
        return null;
      }

      const beforeState = (payload.before_state && typeof payload.before_state === 'object') ? payload.before_state : {};
      const afterState = (payload.after_state && typeof payload.after_state === 'object') ? payload.after_state : {};

      if (eventName.startsWith('identity_')) {
        const changes = buildIdentityChanges(
          beforeState as Record<string, any>,
          afterState as Record<string, any>,
        );

        return {
          id: event.id,
          createdAt: event.createdAt,
          icon: getEventIcon(eventName || event.eventType),
          title: getTimelineEventTitle(eventName || event.eventType),
          changes,
        };
      }

      if (eventName.startsWith('dynamic_field_value_')) {
        const changes = buildDynamicFieldValueChanges(
          payload as Record<string, any>,
          beforeState as Record<string, any>,
          afterState as Record<string, any>,
        );

        return {
          id: event.id,
          createdAt: event.createdAt,
          icon: getEventIcon(eventName || event.eventType),
          title: getTimelineEventTitle(eventName || event.eventType),
          changes,
        };
      }

      const allKeys = Array.from(new Set([
        ...Object.keys(beforeState || {}),
        ...Object.keys(afterState || {}),
      ]))
        .filter((key) => {
          const normalizedKey = normalizeTimelineFieldKey(key);

          return !hiddenTimelineFields.has(normalizedKey) && !isSystemTimelineField(normalizedKey);
        });

      const changes = allKeys.map((key) => ({
        key,
        before: (beforeState as any)[key],
        after: (afterState as any)[key],
      }));

      if (eventName === 'client_tag_created' || eventName === 'client_tag_deleted') {
        const beforeTagID = extractTagID(beforeState as Record<string, any>);
        const afterTagID = extractTagID(afterState as Record<string, any>) || String((payload as any)?.tag_id || '');
        const beforeTagName = resolveTagNameByID(beforeTagID);
        const afterTagName = resolveTagNameByID(afterTagID);

        if (beforeTagName || afterTagName) {
          changes.unshift({
            key: 'tag',
            before: beforeTagName || undefined,
            after: afterTagName || undefined,
          });
        }
      }

      return {
        id: event.id,
        createdAt: event.createdAt,
        icon: getEventIcon(eventName || event.eventType),
        title: getTimelineEventTitle(eventName || event.eventType),
        changes,
      };
    })
    .filter((item): item is TimelineItem => item !== null);
});

const groupedTimeline = computed<TimelineGroup[]>(() => {
  const groups = new Map<string, TimelineGroup>();

  for (const item of timelineItems.value) {
    const dayKey = getDayKey(item.createdAt);
    const existing = groups.get(dayKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(dayKey, {
      dayKey,
      title: formatGroupTitle(item.createdAt),
      items: [item],
    });
  }

  return Array.from(groups.values());
});

function handleTimelineScroll() {
  if (!timelineScrollRef.value) return;

  isTimelineAtTop.value = timelineScrollRef.value.scrollTop <= 0;

  const remaining = timelineScrollRef.value.scrollHeight
    - timelineScrollRef.value.scrollTop
    - timelineScrollRef.value.clientHeight;

  if (remaining < 140 && props.hasMore && !props.loading && !props.loadingMore) {
    emit('load-more');
  }
}

function requestMoreIfNeeded() {
  if (!timelineScrollRef.value || !props.hasMore || props.loading || props.loadingMore) {
    return;
  }

  const notScrollableYet = timelineScrollRef.value.scrollHeight <= timelineScrollRef.value.clientHeight + 8;
  if (notScrollableYet) {
    emit('load-more');
  }
}

watch(
  () => [groupedTimeline.value.length, timelineItems.value.length, props.hasMore, props.loading, props.loadingMore],
  async () => {
    await nextTick();
    requestMoreIfNeeded();
  },
  { immediate: true },
);

function scrollTimelineToTop() {
  if (!timelineScrollRef.value) return;

  timelineScrollRef.value.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function formatDate(date: string | Date): string {
  const localeTag = locale.value === 'ru' ? 'ru-RU' : 'en-US';
  return new Date(date).toLocaleString(localeTag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactTimelineValue(value: any): any {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => compactTimelineValue(entry))
      .filter((entry) => !isEmptyValue(entry));
    return normalized.length ? normalized : null;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalized: Record<string, any> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const nextValue = compactTimelineValue(entryValue);

    if (isEmptyValue(nextValue)) {
      continue;
    }
    if (Array.isArray(nextValue) && nextValue.length === 0) {
      continue;
    }
    if (isPlainObject(nextValue) && Object.keys(nextValue).length === 0) {
      continue;
    }

    normalized[entryKey] = nextValue;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function inferChangeLabelFromValue(value: unknown): string {
  if (!isPlainObject(value)) {
    return '';
  }

  if ('ClientType' in value || 'ShortID' in value || 'Status' in value) {
    return t('contacts.timelineBlockClient');
  }

  if ('FirstName' in value || 'LastName' in value || 'FullName' in value) {
    return t('contacts.timelineBlockIndividual');
  }

  if ('LegalName' in value || 'BrandName' in value || 'BinIin' in value) {
    return t('contacts.timelineBlockLegalEntity');
  }

  return '';
}

function getChangeLabel(change: TimelineChange): string {
  const rawLabel = String(change.label || '').trim();
  const formatted = formatFieldLabel(change.key);
  const candidate = rawLabel || formatted;

  if (candidate && candidate !== ':') {
    return candidate;
  }

  const inferred = inferChangeLabelFromValue(change.after) || inferChangeLabelFromValue(change.before);
  if (inferred) {
    return inferred;
  }

  return t('contacts.timelineBlockData') || t('contacts.timelineField') || 'Поле';
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? (t('contacts.yes') || 'Да') : (t('contacts.no') || 'Нет');
  }

  if (typeof value === 'object') {
    const compactValue = compactTimelineValue(value);
    if (compactValue === null || compactValue === undefined) {
      return '—';
    }

    try {
      return JSON.stringify(compactValue, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function getTimelineEventTitle(eventName: string): string {
  const normalized = String(eventName || '').toLowerCase();
  const translated = t(`contacts.timelineEvents.${normalized}`);
  return translated !== `contacts.timelineEvents.${normalized}` ? translated : eventName;
}

function getDayKey(date: string | Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatGroupTitle(date: string | Date): string {
  const target = new Date(date);
  const now = new Date();

  const targetDayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((todayStart - targetDayStart) / 86400000);

  if (dayDiff === 0) {
    return t('contacts.timelineToday') || 'Сегодня';
  }
  if (dayDiff === 1) {
    return t('contacts.timelineYesterday') || 'Вчера';
  }

  const localeTag = locale.value === 'ru' ? 'ru-RU' : 'en-US';
  return target.toLocaleDateString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatFieldLabel(rawKey: string): string {
  const normalized = String(rawKey || '').trim();
  if (!normalized) {
    return t('contacts.timelineField');
  }

  const snake = normalizeTimelineFieldKey(normalized);

  const translated = t(`contacts.timelineFields.${snake}`);
  return translated !== `contacts.timelineFields.${snake}` ? translated : normalized;
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden sticky top-6">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-heroicons-clock"
          class="w-5 h-5 text-cyan-600 dark:text-cyan-400"
        />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('contacts.timeline') }}
        </h2>
      </div>
      <UButton
        v-if="events.length > 0 && !isTimelineAtTop"
        icon="i-heroicons-arrow-up-20-solid"
        size="xs"
        color="gray"
        variant="ghost"
        @click="scrollTimelineToTop"
      />
    </div>

    <div
      ref="timelineScrollRef"
      class="px-5 py-4 max-h-[calc(100vh-200px)] overflow-y-auto"
      @scroll="handleTimelineScroll"
    >
      <div
        v-if="loading"
        class="text-sm text-gray-500 dark:text-gray-400 text-center py-8"
      >
        {{ t('common.loading') || 'Загрузка...' }}
      </div>

      <div
        v-else-if="timelineItems.length === 0"
        class="text-sm text-gray-500 dark:text-gray-400 text-center py-8"
      >
        {{ t('contacts.noTimelineEvents') || 'Событий пока нет' }}
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <section
          v-for="group in groupedTimeline"
          :key="group.dayKey"
          class="space-y-3"
        >
          <div class="sticky top-0 z-10 -mx-1 rounded bg-white/90 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 backdrop-blur dark:bg-gray-800/90 dark:text-gray-400">
            {{ group.title }}
          </div>

          <ul class="space-y-6">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="relative pl-10"
            >
              <div
                v-if="item.id !== group.items[group.items.length - 1]?.id"
                class="absolute left-[14px] top-8 bottom-[-24px] w-px bg-gray-200/80 dark:bg-gray-700/80"
              />

              <div class="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 ring-1 ring-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:ring-cyan-800">
                <UIcon
                  :name="item.icon"
                  class="h-4 w-4"
                />
              </div>

              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ item.title }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(item.createdAt) }}
                  </p>
                </div>

                <div
                  v-if="item.changes.length"
                  class="mt-3 space-y-2"
                >
                  <div
                    v-for="change in item.changes"
                    :key="`${item.id}-${change.key}`"
                    class="rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 dark:bg-gray-900/40 dark:text-gray-300"
                  >
                    <span class="font-medium">{{ getChangeLabel(change) }}:</span>
                    <div class="mt-1 grid grid-cols-1 gap-1 text-gray-500 dark:text-gray-400">
                      <div class="whitespace-pre-wrap break-words">
                        {{ t('contacts.timelineBefore') || 'Было' }}: {{ formatValue(change.before) }}
                      </div>
                      <div class="whitespace-pre-wrap break-words">
                        {{ t('contacts.timelineAfter') || 'Стало' }}: {{ formatValue(change.after) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div
        v-if="!loading && props.loadingMore"
        class="py-3 text-center text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('contacts.timelineLoadingMore') || 'Загружаем еще...' }}
      </div>

      <div
        v-if="!loading && !props.loadingMore && !props.hasMore && timelineItems.length > 0"
        class="py-3 text-center text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('contacts.timelineEnd') || 'Это все события' }}
      </div>
    </div>
  </div>
</template>
