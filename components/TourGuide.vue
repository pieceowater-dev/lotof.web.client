<script setup lang="ts">
import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue';
import { useOnboarding } from '@/composables/useOnboarding';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const {
  isRunning,
  currentStep,
  currentStepIndex,
  totalSteps,
  canGoNext,
  canGoPrevious,
  nextStep,
  previousStep,
  skipTour,
} = useOnboarding();

// Highlight element position and size
const highlightRect = ref<{ top: number; left: number; width: number; height: number; padding: number } | null>(null);
const popupRect = ref<{ top: number; left: number; width: number; placement: 'top' | 'bottom' | 'left' | 'right' } | null>(null);
const missingTargetAttempts = ref(0);

function isElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0
    && rect.height > 0
    && rect.bottom >= 0
    && rect.right >= 0
    && rect.top <= window.innerHeight
    && rect.left <= window.innerWidth;
}

function resolveTargetElement(target: string | string[]): Element | null {
  const selectors = Array.isArray(target)
    ? target
    : target.split(',').map((s) => s.trim()).filter(Boolean);

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const visible = nodes.find(isElementVisible);
    if (visible) return visible;
  }

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) return node;
  }

  return null;
}

function updateHighlight() {
  if (!currentStep.value || !isRunning.value) {
    highlightRect.value = null;
    popupRect.value = null;
    missingTargetAttempts.value = 0;
    return;
  }

  const target = resolveTargetElement(currentStep.value.target);
  if (!target) {
    missingTargetAttempts.value += 1;
    if (missingTargetAttempts.value < 4) {
      setTimeout(updateHighlight, 200);
      return;
    }

    console.warn('Tour target not found, skipping step:', currentStep.value.target);
    missingTargetAttempts.value = 0;
    if (canGoNext.value) nextStep();
    else skipTour();
    return;
  }

  missingTargetAttempts.value = 0;

  const rect = target.getBoundingClientRect();
  const padding = currentStep.value.highlightPadding || 8;

  highlightRect.value = {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
    padding,
  };

  // Calculate popup position
  const placement = currentStep.value.placement || 'bottom';
  calculatePopupPosition(rect, placement, padding);

  // Scroll target into view
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function calculatePopupPosition(
  targetRect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  padding: number
) {
  const popupWidth = 360; // max-w-sm = 384px, use 360 for safety
  const estimatedHeight = 220;
  const gap = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let effectivePlacement = placement;

  // On small screens avoid left/right placement to prevent overlap.
  if (viewportWidth < 768 && (placement === 'left' || placement === 'right')) {
    effectivePlacement = 'bottom';
  }

  if (effectivePlacement === 'left' && targetRect.left < popupWidth + gap) {
    effectivePlacement = 'bottom';
  }

  if (effectivePlacement === 'right' && (targetRect.right + popupWidth + gap) > viewportWidth) {
    effectivePlacement = 'bottom';
  }

  let top = 0;
  let left = 0;

  switch (effectivePlacement) {
    case 'bottom':
      top = targetRect.bottom + window.scrollY + gap;
      left = targetRect.left + window.scrollX + targetRect.width / 2 - popupWidth / 2;
      if (top + estimatedHeight > window.scrollY + viewportHeight) {
        effectivePlacement = 'top';
      }
      break;
    case 'top':
      top = targetRect.top + window.scrollY - gap - estimatedHeight;
      left = targetRect.left + window.scrollX + targetRect.width / 2 - popupWidth / 2;
      if (top < window.scrollY + 8) {
        effectivePlacement = 'bottom';
      }
      break;
    case 'left':
      top = targetRect.top + window.scrollY + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.left + window.scrollX - popupWidth - gap;
      break;
    case 'right':
      top = targetRect.top + window.scrollY + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.right + window.scrollX + gap;
      break;
  }

  if (effectivePlacement !== placement) {
    return calculatePopupPosition(targetRect, effectivePlacement, padding);
  }

  // Constrain to viewport
  const maxLeft = window.innerWidth - popupWidth - 16;
  left = Math.max(16, Math.min(left, maxLeft));

  popupRect.value = { top, left, width: popupWidth, placement: effectivePlacement };
}

watch([isRunning, currentStep], async () => {
  if (isRunning.value && currentStep.value) {
    await nextTick();
    updateHighlight();
  } else {
    highlightRect.value = null;
    popupRect.value = null;
  }
});

onMounted(() => {
  window.addEventListener('resize', updateHighlight);
  window.addEventListener('scroll', updateHighlight, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateHighlight);
  window.removeEventListener('scroll', updateHighlight, true);
});

const progress = computed(() => {
  if (!totalSteps.value) return 0;
  return ((currentStepIndex.value + 1) / totalSteps.value) * 100;
});

const stepTitle = computed(() => {
  if (!currentStep.value) return '';
  if (currentStep.value.titleKey) return t(currentStep.value.titleKey);
  return currentStep.value.title || '';
});

const stepContent = computed(() => {
  if (!currentStep.value) return '';
  if (currentStep.value.contentKey) return t(currentStep.value.contentKey);
  return currentStep.value.content || '';
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isRunning && currentStep" class="tour-guide-overlay">
      <!-- Dark backdrop with cutout for highlighted element -->
      <div class="fixed inset-0 z-[9998]" @click="skipTour">
        <svg class="w-full h-full">
          <defs>
            <mask id="tour-spotlight">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                v-if="highlightRect"
                :x="highlightRect.left - highlightRect.padding"
                :y="highlightRect.top - highlightRect.padding"
                :width="highlightRect.width + highlightRect.padding * 2"
                :height="highlightRect.height + highlightRect.padding * 2"
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#tour-spotlight)"
          />
        </svg>
      </div>

      <!-- Highlight border -->
      <div
        v-if="highlightRect"
        class="fixed z-[9999] border-4 border-primary rounded-xl pointer-events-none transition-all duration-300"
        :style="{
          top: `${highlightRect.top - highlightRect.padding}px`,
          left: `${highlightRect.left - highlightRect.padding}px`,
          width: `${highlightRect.width + highlightRect.padding * 2}px`,
          height: `${highlightRect.height + highlightRect.padding * 2}px`,
        }"
      />

      <!-- Popup card -->
      <div
        v-if="popupRect"
        class="fixed z-[10000] bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm transition-all duration-300"
        :style="{
          top: `${popupRect.top}px`,
          left: `${popupRect.left}px`,
          width: `${popupRect.width}px`,
        }"
      >
        <!-- Progress bar -->
        <div class="mb-4">
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{{ t('app.step') || 'Step' }} {{ currentStepIndex + 1 }} / {{ totalSteps }}</span>
            <span>{{ Math.round(progress) }}%</span>
          </div>
          <div class="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
          {{ stepTitle }}
        </h3>

        <!-- Content -->
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {{ stepContent }}
        </p>

        <!-- Navigation -->
        <div class="flex items-center justify-between gap-2">
          <UButton
            variant="ghost"
            size="sm"
            @click="skipTour"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {{ t('app.skip') || 'Skip' }}
          </UButton>

          <div class="flex gap-2">
            <UButton
              v-if="canGoPrevious"
              variant="outline"
              size="sm"
              @click="previousStep"
            >
              <UIcon name="i-lucide-chevron-left" />
            </UButton>

            <UButton
              variant="solid"
              size="sm"
              @click="nextStep"
            >
              <span v-if="canGoNext">{{ t('app.next') || 'Next' }}</span>
              <span v-else>{{ t('app.finish') || 'Finish' }}</span>
              <UIcon v-if="canGoNext" name="i-lucide-chevron-right" />
              <UIcon v-else name="i-lucide-check" />
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tour-guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
