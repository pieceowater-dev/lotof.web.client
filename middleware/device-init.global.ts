import { CookieKeys, LSKeys } from '@/utils/storageKeys';
import { getFingerprintCached, getOrCreateDeviceId } from '@/utils/device';

// Global route middleware to ensure device id and fingerprint are generated
// as early as possible AFTER hub auth (TOKEN cookie present).
export default defineNuxtRouteMiddleware(async () => {
  if (process.server) return;

  try {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!hubToken) return; // Wait until hub auth exists

    // If already present, noop; else generate and persist
  const id = localStorage.getItem(LSKeys.DEVICE_ID);
  const fp = localStorage.getItem(LSKeys.DEVICE_FINGERPRINT);
    if (!id) getOrCreateDeviceId();
    if (!fp) await getFingerprintCached();
  } catch {
    // ignore
  }
});
