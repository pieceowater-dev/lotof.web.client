import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const NUDGE_DISMISSED_KEY = 'phone_nudge_dismissed_at';
const NUDGE_DISMISS_COUNT_KEY = 'phone_nudge_dismiss_count';
const FIRST_SEEN_KEY = 'phone_nudge_first_seen_at';
const NUDGE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between nudges -- re-prompt on navigation, just throttled
const GRACE_PERIOD_MS = 5 * 60 * 1000; // never nudge within 5min of first seeing the app -- registering shouldn't immediately be followed by a demand
const MAX_DISMISSALS = 5; // after this many "remind me later"s, the gate stops being optional

type PhoneGateState = {
  open: boolean;
  blocking: boolean;
  resolve: ((ok: boolean) => void) | null;
};

function getDismissCount(): number {
  try {
    return Number(localStorage.getItem(NUDGE_DISMISS_COUNT_KEY) || 0);
  } catch {
    return 0;
  }
}

// Single source of truth for the "enter your phone number" gate: a hard,
// non-dismissible variant used right before a namespace owner subscribes to
// a plan / installs an app, and a soft, dismissible nudge shown at most once
// every NUDGE_INTERVAL_MS so it never turns into session-start spam -- until
// it's been dismissed MAX_DISMISSALS times, at which point it stops being
// dismissible too (same non-blocking-but-mandatory framing as the hard gate).
export function usePhoneGate() {
  const { user } = useAuth();
  const state = useState<PhoneGateState>('phone_gate', () => ({
    open: false,
    blocking: false,
    resolve: null,
  }));

  const hasPhone = computed(() => Boolean(user.value?.phone && user.value.phone.trim()));

  function requirePhone(): Promise<boolean> {
    if (hasPhone.value) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      state.value = { open: true, blocking: true, resolve };
    });
  }

  function firstSeenAt(): number {
    try {
      const existing = Number(localStorage.getItem(FIRST_SEEN_KEY) || 0);
      if (existing) return existing;
      const now = Date.now();
      localStorage.setItem(FIRST_SEEN_KEY, String(now));
      return now;
    } catch {
      return Date.now();
    }
  }

  function maybeNudge() {
    if (!process.client || hasPhone.value || state.value.open) return;

    // Never nudge right after registration -- a fresh signup shouldn't
    // immediately be met with a demand. Wait out the grace period first.
    if (Date.now() - firstSeenAt() < GRACE_PERIOD_MS) return;

    const dismissals = getDismissCount();
    if (dismissals >= MAX_DISMISSALS) {
      // Ran out of "remind me later"s -- same non-dismissible treatment as
      // the pre-subscribe hard gate, just triggered by nag count instead.
      state.value = { open: true, blocking: true, resolve: null };
      return;
    }

    try {
      const last = Number(localStorage.getItem(NUDGE_DISMISSED_KEY) || 0);
      if (last && Date.now() - last < NUDGE_INTERVAL_MS) return;
    } catch {
      // localStorage unavailable (SSR/private mode) -- skip the nudge rather than spam.
      return;
    }
    state.value = { open: true, blocking: false, resolve: null };
  }

  function onPhoneSaved() {
    try {
      localStorage.removeItem(NUDGE_DISMISS_COUNT_KEY);
      localStorage.removeItem(NUDGE_DISMISSED_KEY);
    } catch {}
    state.value.resolve?.(true);
    state.value = { open: false, blocking: false, resolve: null };
  }

  function onDismiss() {
    if (state.value.blocking) return; // non-dismissible, ignore
    try {
      localStorage.setItem(NUDGE_DISMISSED_KEY, String(Date.now()));
      localStorage.setItem(NUDGE_DISMISS_COUNT_KEY, String(getDismissCount() + 1));
    } catch {}
    state.value.resolve?.(false);
    state.value = { open: false, blocking: false, resolve: null };
  }

  return { state, hasPhone, requirePhone, maybeNudge, onPhoneSaved, onDismiss };
}
