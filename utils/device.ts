import { LSKeys } from '@/utils/storageKeys';

// Compute a reasonably stable browser fingerprint and return a 32-char hex string.
// Collects multiple low-risk, privacy-conscious signals: UA-CH, screen, canvas length,
// WebGL vendor/renderer, media devices count, timezone, battery, network, storage, audio fp.
async function computeFingerprint(): Promise<string> {
  const parts: any[] = [];

  try {
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
    const scr = typeof screen !== 'undefined' ? screen : ({} as any);

    // Basic navigator fields
    parts.push(
      nav.userAgent || '',
      nav.platform || '',
      (nav as any).vendor || '',
      String((nav as any).hardwareConcurrency || ''),
      String((nav as any).deviceMemory || ''),
      nav.language || '',
      Array.isArray((nav as any).languages) ? (nav as any).languages.join(',') : ''
    );

    // Touch / input
    parts.push(String((nav as any).maxTouchPoints || 0));

    // Screen
    parts.push(
      String(scr.width || ''),
      String(scr.height || ''),
      String(scr.availWidth || ''),
      String(scr.availHeight || ''),
      String(scr.colorDepth || ''),
      String(typeof window !== 'undefined' ? window.devicePixelRatio || '' : '')
    );

    // Timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      parts.push(tz, String(new Date().getTimezoneOffset()));
    } catch {}

    // UA Client Hints (high entropy values)
    try {
      const uad: any = (nav as any).userAgentData;
      if (uad) {
        parts.push(String(uad.mobile || ''));
        if (Array.isArray(uad.brands)) parts.push(uad.brands.map((b: any) => `${b.brand}:${b.version}`).join('|'));
        if (typeof uad.getHighEntropyValues === 'function') {
          const he = await uad.getHighEntropyValues(['platform','platformVersion','architecture','bitness','model','uaFullVersion']);
          parts.push(String(he.platform || ''), String(he.platformVersion || ''), String(he.architecture || ''), String(he.bitness || ''), String(he.model || ''), String(he.uaFullVersion || ''));
        }
      }
    } catch {}

    // Canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200; canvas.height = 50;
        ctx.textBaseline = 'alphabetic';
        ctx.font = '16px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('fp-check\u2764\ufe0f', 2, 32);
        ctx.strokeStyle = '#ff0';
        ctx.arc(100, 25, 20, 0, Math.PI, true);
        ctx.stroke();
        const data = canvas.toDataURL('image/png');
        parts.push(String(data.length)); // length is enough entropy without huge payload
      }
    } catch {}

    // WebGL vendor/renderer if available
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbgInfo) {
          const vendor = gl.getParameter((dbgInfo as any).UNMASKED_VENDOR_WEBGL) || '';
          const renderer = gl.getParameter((dbgInfo as any).UNMASKED_RENDERER_WEBGL) || '';
          parts.push(String(vendor), String(renderer));
        }
        // A few extra GL params for more entropy, cheap to read
        try {
          parts.push(String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''));
          const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') || gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
          if (aniso) {
            const MAX = (gl as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT;
            if (MAX) parts.push(String(gl.getParameter(MAX) || ''));
          }
        } catch {}
      }
    } catch {}

    // Media devices count (labels usually empty without permission)
    try {
      const md: any = (nav as any).mediaDevices;
      if (md && typeof md.enumerateDevices === 'function') {
        const list = await md.enumerateDevices();
        parts.push(`mdc:${list?.length || 0}`);
      }
    } catch {}

    // Color gamut support via matchMedia
    try {
      const mm = (q: string) => (typeof matchMedia !== 'undefined' && matchMedia(q).matches) ? '1' : '0';
      parts.push(`gamut:${mm('(color-gamut: srgb)')}${mm('(color-gamut: p3)')}${mm('(color-gamut: rec2020)')}`);
    } catch {}

    // Battery status (not widely supported)
    try {
      const nb: any = (nav as any);
      if (typeof nb.getBattery === 'function') {
        const b = await nb.getBattery();
        parts.push(`bat:${b.charging ? '1' : '0'}:${Math.round((b.level || 0) * 100)}`);
      }
    } catch {}

    // Network information (experimental)
    try {
      const conn: any = (nav as any).connection || (nav as any).mozConnection || (nav as any).webkitConnection;
      if (conn) parts.push(`net:${conn.effectiveType || ''}:${conn.rtt || ''}:${conn.downlink || ''}:${conn.saveData ? 1 : 0}`);
    } catch {}

    // Storage estimate
    try {
      const est = await (navigator as any).storage?.estimate?.();
      if (est) parts.push(`stg:${est.quota || ''}:${est.usage || ''}`);
    } catch {}

    // Minimal audio fingerprint (offline rendering)
    try {
      const AC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (AC) {
        const ctx = new AC(1, 44100, 44100);
        const osc = ctx.createOscillator();
        const comp = ctx.createDynamicsCompressor();
        osc.type = 'triangle';
        osc.frequency.value = 10000;
        osc.connect(comp);
        comp.connect(ctx.destination);
        osc.start(0);
        await ctx.startRendering();
        // Hash a few samples
        const buff = await ctx.startRendering().catch(() => null) || null;
        if (buff) {
          const ch = buff.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < ch.length; i += 5000) sum += Math.abs(ch[i]);
          parts.push(`aud:${sum.toFixed(5)}`);
        }
      }
    } catch {}
  } catch {}

  const raw = parts.join('||');
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Use first 32 hex chars to match common 32-char storage (md5-like length)
  return hex.slice(0, 32);
}

export async function getFingerprintCached(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(LSKeys.DEVICE_FINGERPRINT);
    if (cached) return cached;
    const fp = await computeFingerprint();
    localStorage.setItem(LSKeys.DEVICE_FINGERPRINT, fp);
    return fp;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = localStorage.getItem(LSKeys.DEVICE_ID);
    if (!id) {
      // Prefer crypto UUID; fallback to random hex
      if (typeof window !== 'undefined' && (window.crypto as any)?.randomUUID) {
        id = (window.crypto as any).randomUUID();
      } else {
        const bytes = (typeof window !== 'undefined' && (window.crypto as any)?.getRandomValues)
          ? window.crypto.getRandomValues(new Uint8Array(16))
          : new Uint8Array(16);
        // Weak fallback if crypto not available
        if (!(typeof window !== 'undefined' && (window.crypto as any)?.getRandomValues)) {
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        id = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
      if (id) localStorage.setItem(LSKeys.DEVICE_ID, id);
    }
    return id;
  } catch {
    return null;
  }
}

export async function getDeviceHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;

  const id = getOrCreateDeviceId();
  const fp = await getFingerprintCached();
  if (id) headers['DeviceId'] = id;
  if (fp) headers['Fingerprint'] = fp;
  return headers;
}
