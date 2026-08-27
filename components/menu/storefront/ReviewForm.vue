<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getCatalogReviews, createCatalogReview, type CatalogReview } from '@/api/hub/catalog';
import { logError } from '@/utils/logger';
import { maskProfanity } from '@/utils/profanityFilter';

// Shared between pages/to/[namespace]/menu/index.vue (bottom of the
// storefront) and [orderKey].vue (once an order is closed) -- posting
// requires a Patron identity, same Google login every other Patron action
// in this app uses (no separate registration form). Since patronLogin()
// redirects the whole page rather than opening a popup, a draft typed
// before login would otherwise be lost on the round trip -- stashed in
// localStorage and restored once the Patron identity comes back.
const props = defineProps<{ businessId: string | null }>();

const { t } = useI18n();
const { token: patronToken, login: patronLogin } = usePatronAuth();

const reviews = ref<CatalogReview[]>([]);
const loading = ref(false);
const rating = ref(0);
const hoverRating = ref(0);
const body = ref('');
const submitting = ref(false);
const submitted = ref(false);
const error = ref('');

const draftKey = computed(() => (props.businessId ? `lota_review_draft_${props.businessId}` : null));

async function loadReviews() {
  if (!props.businessId) return;
  loading.value = true;
  try {
    reviews.value = await getCatalogReviews(props.businessId);
  } catch (e) {
    logError('[review-form] failed to load reviews', e);
  } finally {
    loading.value = false;
  }
}

function restoreDraft() {
  if (!draftKey.value || !process.client) return;
  try {
    const raw = localStorage.getItem(draftKey.value);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.rating) rating.value = draft.rating;
    if (draft.body) body.value = draft.body;
  } catch {}
}

function saveDraft() {
  if (!draftKey.value || !process.client) return;
  try {
    localStorage.setItem(draftKey.value, JSON.stringify({ rating: rating.value, body: body.value }));
  } catch {}
}

function clearDraft() {
  if (!draftKey.value || !process.client) return;
  try {
    localStorage.removeItem(draftKey.value);
  } catch {}
}

onMounted(() => {
  loadReviews();
  if (patronToken.value) restoreDraft();
});

const canSubmit = computed(() => rating.value > 0 && body.value.trim().length > 0 && !submitting.value);

async function submit() {
  if (!props.businessId || !canSubmit.value) return;
  error.value = '';

  if (!patronToken.value) {
    // Quietly routes through the same Google login every Patron action
    // uses -- posting a review just requires knowing who posted it.
    saveDraft();
    patronLogin();
    return;
  }

  submitting.value = true;
  try {
    await createCatalogReview(patronToken.value, props.businessId, rating.value, body.value.trim());
    clearDraft();
    submitted.value = true;
    rating.value = 0;
    body.value = '';
    await loadReviews();
  } catch (e) {
    logError('[review-form] submit failed', e);
    error.value = t('menu.reviewSubmitError') || 'Не удалось отправить отзыв';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div v-if="businessId" class="space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('menu.reviewsHeading') || 'Отзывы' }}</h2>

    <div v-if="loading" class="text-xs text-gray-400">{{ t('menu.loading') || 'Загрузка…' }}</div>
    <div v-else-if="reviews.length" class="space-y-2.5">
      <div
        v-for="r in reviews"
        :key="r.id"
        class="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ maskProfanity(r.authorName) }}</span>
          <div class="flex-shrink-0 flex items-center gap-0.5">
            <Icon
              v-for="i in 5"
              :key="i"
              name="lucide:star"
              class="w-3.5 h-3.5"
              :class="i <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-gray-700'"
            />
          </div>
        </div>
        <p class="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{{ maskProfanity(r.body) }}</p>
      </div>
    </div>

    <div v-if="submitted" class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2.5">
      {{ t('menu.reviewSubmitted') || 'Спасибо за отзыв!' }}
    </div>

    <div v-else class="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('menu.leaveReview') || 'Оставить отзыв' }}</p>
      <div class="flex items-center gap-1">
        <button
          v-for="i in 5"
          :key="i"
          type="button"
          class="p-0.5"
          @mouseenter="hoverRating = i"
          @mouseleave="hoverRating = 0"
          @click="rating = i"
        >
          <Icon
            name="lucide:star"
            class="w-6 h-6"
            :class="i <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-gray-700'"
          />
        </button>
      </div>
      <textarea
        v-model="body"
        rows="3"
        :placeholder="t('menu.reviewPlaceholder') || 'Расскажите, как вам заведение'"
        class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
      />
      <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        type="button"
        class="w-full rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium py-2.5 disabled:opacity-40"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ submitting ? (t('menu.sending') || 'Отправка…') : (t('menu.submitReview') || 'Отправить отзыв') }}
      </button>
    </div>
  </div>
</template>
