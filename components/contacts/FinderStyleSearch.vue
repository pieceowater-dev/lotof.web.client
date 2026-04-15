<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { listTags, type Tag } from '@/api/contacts/tags';

const { t } = useI18n();
const { token } = useAuth();
const { ensure } = useContactsToken();
const { selected: selectedNS } = useNamespace();

interface Props {
  selectedTags?: Array<{ id: string; name: string }>;
  searchQuery?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:selectedTags', value: Array<{ id: string; name: string }>): void;
  (e: 'update:searchQuery', value: string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref(props.searchQuery || '');
const showDropdown = ref(false);
const availableTags = ref<Tag[]>([]);
const loading = ref(false);
const highlightedIndex = ref(0);

const localSelectedTags = ref<Array<{ id: string; name: string }>>(props.selectedTags || []);
const localSearchQuery = ref(props.searchQuery || '');

// Watch external changes
watch(() => props.selectedTags, (newTags) => {
  if (newTags) {
    localSelectedTags.value = [...newTags];
  }
}, { deep: true });

watch(() => props.searchQuery, (newQuery) => {
  if (newQuery !== undefined) {
    localSearchQuery.value = newQuery;
    // Sync the visible input value when prop changes externally (e.g. from URL)
    if (newQuery !== inputValue.value) {
      inputValue.value = newQuery;
    }
  }
});

// Filter tags based on input
const filteredTags = computed(() => {
  const query = inputValue.value.toLowerCase().trim();
  if (!query) return availableTags.value;
  
  return availableTags.value.filter(tag => 
    tag.name.toLowerCase().includes(query) &&
    !localSelectedTags.value.find(t => t.id === tag.id)
  );
});

async function loadAvailableTags() {
  if (!token.value || !selectedNS.value) return;
  
  try {
    loading.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    
    const response = await listTags(contactsToken, selectedNS.value);
    availableTags.value = response.tags.rows;
  } catch (error) {
    console.error('Failed to load tags:', error);
  } finally {
    loading.value = false;
  }
}

function handleInputFocus() {
  // Don't show dropdown on focus, only on input
  highlightedIndex.value = 0;
}

function handleInputBlur() {
  // Delay to allow click on dropdown items
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  showDropdown.value = true;
  highlightedIndex.value = 0;
}

function selectTag(tag: Tag) {
  const newTags = [...localSelectedTags.value, { id: tag.id, name: tag.name }];
  localSelectedTags.value = newTags;
  emit('update:selectedTags', newTags);
  
  inputValue.value = '';
  showDropdown.value = false;
  
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function removeTag(tagId: string) {
  const newTags = localSelectedTags.value.filter(t => t.id !== tagId);
  localSelectedTags.value = newTags;
  emit('update:selectedTags', newTags);
  
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function handleKeyDown(event: KeyboardEvent) {
  // Handle backspace to remove last tag chip
  if (event.key === 'Backspace' && inputValue.value === '' && localSelectedTags.value.length > 0) {
    event.preventDefault();
    const newTags = localSelectedTags.value.slice(0, -1);
    localSelectedTags.value = newTags;
    emit('update:selectedTags', newTags);
    return;
  }
  
  // Ignore Enter if input is empty
  if (event.key === 'Enter' && (!inputValue.value || inputValue.value.trim() === '')) {
    event.preventDefault();
    return;
  }
  
  if (!showDropdown.value || filteredTags.value.length === 0) {
    // Handle enter for text search
    if (event.key === 'Enter') {
      handleTextSearch();
    }
    return;
  }
  
  // Navigate dropdown
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredTags.value.length - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      event.preventDefault();
      if (filteredTags.value[highlightedIndex.value]) {
        selectTag(filteredTags.value[highlightedIndex.value]);
      } else {
        handleTextSearch();
      }
      break;
    case 'Escape':
      event.preventDefault();
      showDropdown.value = false;
      break;
  }
}

function handleTextSearch() {
  const searchText = inputValue.value.trim();
  localSearchQuery.value = searchText;
  emit('update:searchQuery', searchText);
  showDropdown.value = false;
}

function clearAll() {
  localSelectedTags.value = [];
  localSearchQuery.value = '';
  inputValue.value = '';
  emit('update:selectedTags', []);
  emit('update:searchQuery', '');
  
  nextTick(() => {
    inputRef.value?.focus();
  });
}

// Auto-search on input change (debounced text search)
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(inputValue, (newVal) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  
  // If input is cleared, reset search immediately
  if (!newVal || newVal.trim() === '') {
    localSearchQuery.value = '';
    emit('update:searchQuery', '');
    showDropdown.value = false;
    return;
  }
  
  // If input doesn't match any tags and user stops typing, treat as text search
  searchTimeout = setTimeout(() => {
    if (newVal && filteredTags.value.length === 0) {
      handleTextSearch();
    }
  }, 800);
});

onMounted(() => {
  loadAvailableTags();
  
  // Auto-focus on desktop only (not mobile)
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});
</script>

<template>
  <div class="relative w-full">
    <!-- Search input container (Finder-style) -->
    <div 
      class="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 dark:focus-within:ring-emerald-400 focus-within:border-transparent transition-all min-h-[40px]"
      @click="inputRef?.focus()"
    >
      <!-- Search icon -->
      <UIcon
        name="lucide:search"
        class="w-4 h-4 text-gray-400 flex-shrink-0"
      />
      
      <!-- Selected tag chips -->
      <div
        v-for="tag in localSelectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <UIcon
          name="lucide:tag"
          class="w-3 h-3 text-gray-500 dark:text-gray-400"
        />
        <span class="text-xs">{{ tag.name }}</span>
        <button
          class="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-sm transition-colors p-0.5"
          :title="`Remove ${tag.name}`"
          @click.stop="removeTag(tag.id)"
        >
          <UIcon
            name="lucide:x"
            class="w-2.5 h-2.5"
          />
        </button>
      </div>
      
      <!-- Input field -->
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :placeholder="localSelectedTags.length > 0 || localSearchQuery ? '' : t('contacts.searchPlaceholder') || 'Search or add tags...'"
        class="flex-1 min-w-[100px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
        @input="handleInput"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
        @keydown="handleKeyDown"
      >
      
      <!-- Clear button -->
      <button
        v-if="localSelectedTags.length > 0 || localSearchQuery || inputValue"
        class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Clear all"
        @click.stop="clearAll"
      >
        <UIcon
          name="lucide:x-circle"
          class="w-4 h-4"
        />
      </button>
    </div>
    
    <!-- Dropdown with tag suggestions -->
    <div
      v-if="showDropdown && inputValue && (filteredTags.length > 0 || loading)"
      class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
    >
      <!-- Loading state -->
      <div
        v-if="loading"
        class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
      >
        <UIcon
          name="lucide:loader-2"
          class="w-4 h-4 animate-spin inline mr-2"
        />
        {{ t('common.loading') }}...
      </div>
      
      <!-- Tag list as chips -->
      <div
        v-else
        class="p-3"
      >
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(tag, index) in filteredTags"
            :key="tag.id"
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer',
              index === highlightedIndex
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            ]"
            @click="selectTag(tag)"
            @mouseenter="highlightedIndex = index"
          >
            <UIcon
              name="lucide:tag"
              class="w-3.5 h-3.5"
            />
            <span>{{ tag.name }}</span>
          </button>
        </div>
        
        <!-- No results hint -->
        <div 
          v-if="filteredTags.length === 0 && inputValue"
          class="text-sm text-gray-500 dark:text-gray-400 text-center mt-2"
        >
          Press <kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> to search for "{{ inputValue }}"
        </div>
      </div>
    </div>
  </div>
</template>
