import { useI18n } from '@/composables/useI18n';
// Gives every switch (UToggle renders <button role="switch">) an accessible name.
// Almost all of them sit next to a visible text label but are not wired to it, so
// a screen reader announced just "switch". The name is taken from the nearest
// text in the same row; an explicit aria-label / aria-labelledby always wins.
export default defineNuxtPlugin(() => {
  const { t } = useI18n();
  const nameFor = (el: HTMLElement): string => {
    let node: HTMLElement | null = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button,input,select,textarea,svg,[role=switch]').forEach((n) => n.remove());
      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text.slice(0, 80);
    }
    return '';
  };
  // Icon-only buttons nobody named (a toast's close «×», for instance): reuse the
  // tooltip text if there is one, otherwise a close icon is just called «Close».
  const labelIconButtons = () => {
    document.querySelectorAll<HTMLElement>('button:not([aria-label]):not([aria-labelledby])').forEach((el) => {
      if ((el.textContent || '').trim()) return;
      const title = el.getAttribute('title');
      if (title) { el.setAttribute('aria-label', title); return; }
      if (el.querySelector('[class*="i-lucide:x"], [class*="i-heroicons:x-mark"], [class*="x-mark"]')) el.setAttribute('aria-label', t('common.close'));
    });
  };
  const label = () => {
    labelIconButtons();
    document.querySelectorAll<HTMLElement>('button[role="switch"]:not([aria-label]):not([aria-labelledby])').forEach((el) => {
      const n = nameFor(el);
      if (n) el.setAttribute('aria-label', n);
    });
  };
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; label(); });
  };
  onNuxtReady(() => {
    label();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  });
});
