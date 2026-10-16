// Gives every switch (UToggle renders <button role="switch">) an accessible name.
// Almost all of them sit next to a visible text label but are not wired to it, so
// a screen reader announced just "switch". The name is taken from the nearest
// text in the same row; an explicit aria-label / aria-labelledby always wins.
export default defineNuxtPlugin(() => {
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
  const label = () => {
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
