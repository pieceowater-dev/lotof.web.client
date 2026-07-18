import { getErrorMessage } from '@/utils/types/errors';

// Map of known backend error messages to localization keys
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'namespace header is missing': 'common.namespaceMissing',
};

// Localizes known backend error messages (A-Trace settings page); falls
// back to the raw message or a generic error string.
export function localizeAtraceErrorMessage(error: unknown, t: (key: string) => string): string {
  const message = getErrorMessage(error);

  const localizationKey = ERROR_MESSAGE_MAP[message];
  if (localizationKey) {
    return t(localizationKey);
  }

  return message || (t('common.genericError') || 'Something went wrong. Please try again.');
}
