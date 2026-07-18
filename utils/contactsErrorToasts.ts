// Shared parsing of resource-limit (plan quota) errors surfaced by the
// contacts backend, for the two resources that can hit a plan limit in the
// settings page: loyalty programs (stamp cards) and custom (dynamic) fields.
import { getErrorMessage } from '@/utils/types/errors';

export type ResourceLimitKind = 'loyaltyPrograms' | 'customFields';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface ResourceLimitConfig {
  // Prefix of the backend's plain-English limit message, e.g. "Loyalty programs limit reached".
  matchText: string;
  // Singular noun stem used in "You have N <noun>(s), maximum allowed is M".
  nounStem: string;
  limitReachedKey: string;
  limitReachedFallback: string;
  genericFallback: string;
}

const RESOURCE_CONFIG: Record<ResourceLimitKind, ResourceLimitConfig> = {
  loyaltyPrograms: {
    matchText: 'Loyalty programs limit reached',
    nounStem: 'program',
    limitReachedKey: 'contacts.loyaltyProgramsLimitReached',
    limitReachedFallback: 'Достигнут лимит программ лояльности: {current} из {max}. Обновите тариф, чтобы создать новую программу.',
    genericFallback: 'Ошибка создания программы лояльности',
  },
  customFields: {
    matchText: 'Custom fields limit reached',
    nounStem: 'field',
    limitReachedKey: 'contacts.customFieldsLimitReached',
    limitReachedFallback: 'Достигнут лимит пользовательских полей: {current} из {max}. Обновите тариф, чтобы создать новое поле.',
    genericFallback: 'Ошибка создания поля',
  },
};

export function parseResourceLimitErrorToast(
  error: unknown,
  resourceKind: ResourceLimitKind,
  t: Translate,
): { title: string; description: string } {
  const config = RESOURCE_CONFIG[resourceKind];
  const rawMessage = getErrorMessage(error);
  const compactMessage = rawMessage.replace(/^rpc error:\s*code\s*=\s*\w+\s*desc\s*=\s*/i, '').trim();

  const limitMatch = compactMessage.match(
    new RegExp(`${config.matchText}\\.\\s*You have\\s+(\\d+)\\s+${config.nounStem}s?,\\s*maximum allowed is\\s+(\\d+)`, 'i'),
  );

  if (/ResourceExhausted/i.test(rawMessage) && limitMatch) {
    const current = limitMatch[1];
    const max = limitMatch[2];
    return {
      title: t('contacts.limitReachedTitle') || 'Лимит тарифа достигнут',
      description: (t(config.limitReachedKey, { current, max }) || config.limitReachedFallback)
        .replace('{current}', current)
        .replace('{max}', max),
    };
  }

  if (/ResourceExhausted/i.test(rawMessage)) {
    return {
      title: t('contacts.limitReachedTitle') || 'Лимит тарифа достигнут',
      description: compactMessage || t('common.error') || config.genericFallback,
    };
  }

  if (/FailedPrecondition/i.test(rawMessage)) {
    return {
      title: t('common.warning') || 'Предупреждение',
      description: t('contacts.planValidationError') || 'Не удалось проверить лимиты текущего тарифа. Попробуйте снова через несколько секунд.',
    };
  }

  return {
    title: t('common.error') || 'Error',
    description: t('common.error') || config.genericFallback,
  };
}
