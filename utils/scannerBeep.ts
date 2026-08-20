// A short synthesized "beep" mimicking a handheld barcode scanner --
// no audio asset needed. One shared AudioContext is reused across calls
// (creating a fresh one per beep is wasteful and some browsers cap how
// many can exist); it's created lazily on first use since AudioContext
// can't be constructed before a user gesture on most browsers anyway,
// and Enter-in-the-search-box already is one.
let ctx: AudioContext | null = null;

export function playScannerBeep() {
  if (!process.client) return;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1500;

    const now = ctx.currentTime;
    // Quick fade in/out instead of a hard on/off -- avoids the audible
    // click a square wave produces when it starts/stops mid-cycle.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
    gain.gain.setValueAtTime(0.15, now + 0.08);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Audio is a nicety here, not a requirement -- never let a beep
    // failure interrupt the actual scan/checkout flow.
  }
}
