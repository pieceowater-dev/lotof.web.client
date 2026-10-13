import { getCall } from '@/api/contacts/telephony';
import { useCrmAuth } from '@/composables/useCrmAuth';

// One recording at a time, played by the floating widget (CallPlayerWidget).
// Any screen can start playback with play(call); the widget lives in the
// workspace layout, so audio keeps playing while the user navigates.

export interface PlayableCall {
  id: string;
  clientName?: string | null;
  clientPhone: string;
  startedAt: string;
  durationSec?: number;
  direction?: string | null;
}

export interface PlayerState {
  call: PlayableCall | null;
  src: string;
  loading: boolean;
  /** Recording exists but cannot be played in the browser (e.g. provider reference we cannot resolve). */
  unavailable: boolean;
  /** Bumped on every play() so the widget restarts even for the same call. */
  nonce: number;
}

export function useCallPlayer() {
  const state = useState<PlayerState>('call-player', () => ({ call: null, src: '', loading: false, unavailable: false, nonce: 0 }));
  const { ctx } = useCrmAuth();

  async function play(call: PlayableCall) {
    state.value = { call, src: '', loading: true, unavailable: false, nonce: state.value.nonce + 1 };
    try {
      const c = await ctx();
      if (!c) throw new Error('no contacts access');
      // The stored reference may be a provider id; opening the call resolves a fresh link.
      const fresh = await getCall(c.token, c.ns, call.id);
      const ref = fresh.recordingRef || '';
      if (/^https:\/\//.test(ref)) {
        state.value = { ...state.value, src: ref, loading: false };
      } else {
        state.value = { ...state.value, loading: false, unavailable: true };
      }
    } catch {
      state.value = { ...state.value, loading: false, unavailable: true };
    }
  }

  function close() {
    state.value = { call: null, src: '', loading: false, unavailable: false, nonce: state.value.nonce };
  }

  return { state, play, close };
}
