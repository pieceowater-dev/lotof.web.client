import { ref, computed } from 'vue';

export type TourStep = {
  id: string;
  target: string | string[]; // CSS selector(s)
  title?: string;
  content?: string;
  titleKey?: string;
  contentKey?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
};

export type TourConfig = {
  id: string;
  steps: TourStep[];
};

const STORAGE_KEY_PREFIX = 'onboarding_';

class OnboardingManager {
  private currentTour = ref<TourConfig | null>(null);
  private currentStepIndex = ref(0);
  private isRunning = ref(false);

  /**
   * Check if user has completed or skipped the onboarding
   */
  isCompleted(tourId: string): boolean {
    if (!process.client) return false;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}`;
      const value = localStorage.getItem(key);
      return value === 'completed' || value === 'skipped';
    } catch {
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  markCompleted(tourId: string) {
    if (!process.client) return;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}`;
      localStorage.setItem(key, 'completed');
    } catch (e) {
      console.error('Failed to save onboarding state:', e);
    }
  }

  /**
   * Mark onboarding as skipped
   */
  markSkipped(tourId: string) {
    if (!process.client) return;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}`;
      localStorage.setItem(key, 'skipped');
    } catch (e) {
      console.error('Failed to save onboarding state:', e);
    }
  }

  /**
   * Reset onboarding state (for manual restart)
   */
  reset(tourId: string) {
    if (!process.client) return;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}`;
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to reset onboarding state:', e);
    }
  }

  /**
   * Get current step progress
   */
  getProgress(tourId: string): number {
    if (!process.client) return 0;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}_progress`;
      const value = localStorage.getItem(key);
      return value ? parseInt(value, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Save current step progress
   */
  saveProgress(tourId: string, stepIndex: number) {
    if (!process.client) return;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}_progress`;
      localStorage.setItem(key, stepIndex.toString());
    } catch (e) {
      console.error('Failed to save onboarding progress:', e);
    }
  }

  /**
   * Start a tour
   */
  startTour(config: TourConfig, fromStep?: number) {
    this.currentTour.value = config;
    this.currentStepIndex.value = fromStep ?? this.getProgress(config.id);
    this.isRunning.value = true;
  }

  /**
   * Stop the current tour
   */
  stopTour() {
    this.isRunning.value = false;
    this.currentTour.value = null;
    this.currentStepIndex.value = 0;
  }

  /**
   * Go to next step
   */
  nextStep() {
    if (!this.currentTour.value) return;
    
    const nextIndex = this.currentStepIndex.value + 1;
    
    if (nextIndex >= this.currentTour.value.steps.length) {
      // Tour completed
      this.markCompleted(this.currentTour.value.id);
      this.stopTour();
    } else {
      this.currentStepIndex.value = nextIndex;
      this.saveProgress(this.currentTour.value.id, nextIndex);
    }
  }

  /**
   * Go to previous step
   */
  previousStep() {
    if (this.currentStepIndex.value > 0) {
      this.currentStepIndex.value--;
      if (this.currentTour.value) {
        this.saveProgress(this.currentTour.value.id, this.currentStepIndex.value);
      }
    }
  }

  /**
   * Skip the tour
   */
  skipTour() {
    if (this.currentTour.value) {
      this.markSkipped(this.currentTour.value.id);
      this.resetProgress(this.currentTour.value.id);
    }
    this.stopTour();
  }

  private resetProgress(tourId: string) {
    if (!process.client) return;
    try {
      const key = `${STORAGE_KEY_PREFIX}${tourId}_progress`;
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to reset onboarding progress:', e);
    }
  }

  /**
   * Get current state
   */
  get state() {
    return {
      isRunning: computed(() => this.isRunning.value),
      currentTour: computed(() => this.currentTour.value),
      currentStep: computed(() => {
        if (!this.currentTour.value) return null;
        return this.currentTour.value.steps[this.currentStepIndex.value] || null;
      }),
      currentStepIndex: computed(() => this.currentStepIndex.value),
      totalSteps: computed(() => this.currentTour.value?.steps.length || 0),
      canGoNext: computed(() => {
        if (!this.currentTour.value) return false;
        return this.currentStepIndex.value < this.currentTour.value.steps.length - 1;
      }),
      canGoPrevious: computed(() => this.currentStepIndex.value > 0),
    };
  }
}

// Singleton instance
const onboardingManager = new OnboardingManager();

export function useOnboarding() {
  return {
    ...onboardingManager.state,
    startTour: onboardingManager.startTour.bind(onboardingManager),
    stopTour: onboardingManager.stopTour.bind(onboardingManager),
    nextStep: onboardingManager.nextStep.bind(onboardingManager),
    previousStep: onboardingManager.previousStep.bind(onboardingManager),
    skipTour: onboardingManager.skipTour.bind(onboardingManager),
    isCompleted: onboardingManager.isCompleted.bind(onboardingManager),
    reset: onboardingManager.reset.bind(onboardingManager),
  };
}
