// Shared sanitize/keydown/paste handling for the 4-digit PIN + confirm-PIN
// input pairs used across the contacts stamp-card forms. Replaces what used
// to be four near-identical copies of the same three handlers.
import type { Ref } from 'vue';

export interface DigitPinFormData {
  stampPin: string;
  confirmStampPin: string;
}

const ALLOWED_CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
]);

export function sanitizePinValue(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function onPinKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (ALLOWED_CONTROL_KEYS.has(event.key)) return;
  if (!/^\d$/.test(event.key)) {
    event.preventDefault();
  }
}

export function useDigitPinInput<T extends DigitPinFormData>(formData: Ref<T>) {
  function onInput(event: Event, field: keyof DigitPinFormData) {
    const target = event.target as HTMLInputElement;
    formData.value[field] = sanitizePinValue(target.value);
  }

  function onPaste(event: ClipboardEvent, field: keyof DigitPinFormData) {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    formData.value[field] = sanitizePinValue(pasted);
  }

  return { onInput, onPaste, onPinKeydown };
}
