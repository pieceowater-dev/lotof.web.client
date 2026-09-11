import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue';

// Closes a dialog on Escape. The custom Teleport-based modals in this
// codebase (console billing/editor dialogs) aren't built on UModal/
// @headlessui/vue's Dialog, so they don't get Escape-to-close for free the
// way UModal does (see FRONTEND_AUDIT.md J2 -- UModal's headlessui Dialog
// already handles this). Each of these already has a backdrop
// click.self-to-close plus a real <button> (X icon or Cancel) a keyboard
// user can Tab to and activate, so this is a convenience addition, not a
// fix for a hard keyboard trap.
//
// A global keydown listener (added only while open, removed on close/
// unmount) rather than @keydown on the backdrop div itself -- a plain,
// non-focused <div> never receives keydown events in the first place, so
// that attribute alone wouldn't actually work.
export function useEscapeToClose(isOpen: Ref<boolean> | ComputedRef<boolean>, onClose: () => void) {
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  watch(
    isOpen,
    (open) => {
      if (typeof window === 'undefined') return;
      if (open) {
        window.addEventListener('keydown', handleKeydown);
      } else {
        window.removeEventListener('keydown', handleKeydown);
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
  });
}
