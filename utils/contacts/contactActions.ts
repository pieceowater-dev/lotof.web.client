// Generic contact-detail action handlers: clipboard copy and quick-contact
// launchers (tel:/mailto:/t.me/wa.me), plus the "back to list" navigation.
import type { Router } from 'vue-router';
import { logError } from '@/utils/logger';

export type ContactActionToast = ReturnType<typeof useToast>;

export async function copyToClipboard(text: string, toast: ContactActionToast, t: (key: string) => string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
    toast.add({
      title: t('contacts.copied'),
      icon: 'i-heroicons-clipboard-document-check',
      color: 'emerald',
    });
  } catch (err) {
    logError('Failed to copy to clipboard', err);
    toast.add({
      title: t('contacts.copyFailed'),
      color: 'red',
    });
  }
}

export function handlePhoneAction(phone: string) {
  window.location.href = `tel:${phone}`;
}

export function handleEmailAction(email: string) {
  window.location.href = `mailto:${email}`;
}

export function handleTelegramAction(telegram: string) {
  const handle = telegram.replace(/^@/, '');
  window.open(`https://t.me/${handle}`, '_blank');
}

export function handleWhatsappAction(phone: string) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}`, '_blank');
}

export function handleBack(router: Pick<Router, 'back' | 'push'>, namespaceSlug: string) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push(`/${namespaceSlug}/contacts/all/1-20`);
  }
}
