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
const lastAutoScrollStepId = ref<string | null>(null);
let rafUpdateId: number | null = null;
let listenersBound = false;

function bindWindowListeners() {
  if (listenersBound) return;
  window.addEventListener('resize', scheduleUpdateHighlight);
  window.addEventListener('scroll', scheduleUpdateHighlight, { capture: true, passive: true });
  listenersBound = true;
}

function unbindWindowListeners() {
  if (!listenersBound) return;
  window.removeEventListener('resize', scheduleUpdateHighlight);
  window.removeEventListener('scroll', scheduleUpdateHighlight, true);
  listenersBound = false;
}

function scheduleUpdateHighlight() {
  if (rafUpdateId !== null) return;
  rafUpdateId = window.requestAnimationFrame(() => {
    rafUpdateId = null;
    updateHighlight({ allowAutoScroll: false });
  });
}

function isElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0
    && rect.height > 0
    && rect.bottom >= 0
    && rect.right >= 0
    && rect.top <= window.innerHeight
    && rect.left <= window.innerWidth;
}

function getViewportMetrics() {
  const vv = window.visualViewport;
  return {
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
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

function updateHighlight(options?: { allowAutoScroll?: boolean }) {
  const allowAutoScroll = options?.allowAutoScroll ?? false;

  if (!currentStep.value || !isRunning.value) {
    highlightRect.value = null;
    popupRect.value = null;
    missingTargetAttempts.value = 0;
    lastAutoScrollStepId.value = null;
    return;
  }

  const target = resolveTargetElement(currentStep.value.target);
  if (!target) {
    missingTargetAttempts.value += 1;
    if (missingTargetAttempts.value < 4) {
      setTimeout(() => updateHighlight({ allowAutoScroll: false }), 200);
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
  const viewport = getViewportMetrics();

  highlightRect.value = {
    top: rect.top + viewport.offsetTop,
    left: rect.left + viewport.offsetLeft,
    width: rect.width,
    height: rect.height,
    padding,
  };

  // Calculate popup position
  const placement = currentStep.value.placement || 'bottom';
  calculatePopupPosition(rect, placement, padding);

  // Auto-scroll only once per step to avoid scroll-update loops and UI jank.
  if (allowAutoScroll && lastAutoScrollStepId.value !== currentStep.value.id) {
    target.scrollIntoView({ behavior: 'instant', block: 'center' });
    lastAutoScrollStepId.value = currentStep.value.id;
  }
}

function calculatePopupPosition(
  targetRect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  padding: number
) {
  const popupWidth = 360; // max-w-sm = 384px, use 360 for safety
  const estimatedHeight = 220;
  const gap = 16;
  const viewport = getViewportMetrics();
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;

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
      top = targetRect.bottom + viewport.offsetTop + gap;
      left = targetRect.left + viewport.offsetLeft + targetRect.width / 2 - popupWidth / 2;
      if (top + estimatedHeight > viewport.offsetTop + viewportHeight) {
        effectivePlacement = 'top';
      }
      break;
    case 'top':
      top = targetRect.top + viewport.offsetTop - gap - estimatedHeight;
      left = targetRect.left + viewport.offsetLeft + targetRect.width / 2 - popupWidth / 2;
      if (top < viewport.offsetTop + 8) {
        effectivePlacement = 'bottom';
      }
      break;
    case 'left':
      top = targetRect.top + viewport.offsetTop + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.left + viewport.offsetLeft - popupWidth - gap;
      break;
    case 'right':
      top = targetRect.top + viewport.offsetTop + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.right + viewport.offsetLeft + gap;
      break;
  }

  if (effectivePlacement !== placement) {
    return calculatePopupPosition(targetRect, effectivePlacement, padding);
  }

  // Constrain to viewport
  const maxLeft = viewport.offsetLeft + viewportWidth - popupWidth - 16;
  left = Math.max(viewport.offsetLeft + 16, Math.min(left, maxLeft));

  popupRect.value = { top, left, width: popupWidth, placement: effectivePlacement };
}

watch([isRunning, currentStep], async () => {
  if (isRunning.value && currentStep.value) {
    bindWindowListeners();
    await nextTick();
    updateHighlight({ allowAutoScroll: true });
  } else {
    unbindWindowListeners();
    highlightRect.value = null;
    popupRect.value = null;
    lastAutoScrollStepId.value = null;
  }
});

onMounted(() => {
  if (isRunning.value) bindWindowListeners();
});

onBeforeUnmount(() => {
  unbindWindowListeners();
  if (rafUpdateId !== null) {
    window.cancelAnimationFrame(rafUpdateId);
    rafUpdateId = null;
  }
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
    <div
      v-if="isRunning && currentStep"
      class="tour-guide-overlay"
    >
      <!-- Global click catcher -->
      <div
        class="fixed inset-0 z-[9998]"
        @click="skipTour"
      />

      <!-- Dark backdrop with rounded cutout around target -->
      <div
        v-if="!highlightRect"
        class="fixed inset-0 z-[9998] bg-black/60 pointer-events-none"
      />
      <template v-else>
        <div
          class="fixed z-[9998] pointer-events-none tour-spotlight-hole"
          :style="{
            top: `${highlightRect.top - highlightRect.padding}px`,
            left: `${highlightRect.left - highlightRect.padding}px`,
            width: `${highlightRect.width + highlightRect.padding * 2}px`,
            height: `${highlightRect.height + highlightRect.padding * 2}px`,
          }"
        />
      </template>

      <!-- Highlight border -->
      <div
        v-if="highlightRect"
        class="fixed z-[9999] border-4 border-primary rounded-xl pointer-events-none"
        :class="'transition-all duration-300'"
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
        class="fixed z-[10000] bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm"
        :class="'shadow-2xl transition-all duration-300'"
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
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            @click="skipTour"
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
              <UIcon
                v-if="canGoNext"
                name="i-lucide-chevron-right"
              />
              <UIcon
                v-else
                name="i-lucide-check"
              />
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

.tour-spotlight-hole {
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
}
</style>
