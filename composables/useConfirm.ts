import { reactive } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: 'red' | 'primary' | 'amber';
  icon?: string;
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'title'>> {
  open: boolean;
  title: string;
}

// Single shared state (not per-component) so one <ConfirmDialog /> mounted
// once in app.vue can serve every call site — mirrors how useToast() works.
const state = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: '',
  color: 'red',
  icon: 'lucide:trash-2',
});

let pendingResolve: ((value: boolean) => void) | null = null;

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      // An earlier confirm that never resolved (shouldn't happen since the
      // dialog is modal) would otherwise leak — settle it as cancelled.
      pendingResolve?.(false);

      state.title = options.title ?? '';
      state.message = options.message;
      state.confirmLabel = options.confirmLabel ?? '';
      state.cancelLabel = options.cancelLabel ?? '';
      state.color = options.color ?? 'red';
      state.icon = options.icon ?? 'lucide:trash-2';
      state.open = true;
      pendingResolve = resolve;
    });
  }

  function handleConfirm() {
    state.open = false;
    pendingResolve?.(true);
    pendingResolve = null;
  }

  function handleCancel() {
    state.open = false;
    pendingResolve?.(false);
    pendingResolve = null;
  }

  return { state, confirm, handleConfirm, handleCancel };
}
