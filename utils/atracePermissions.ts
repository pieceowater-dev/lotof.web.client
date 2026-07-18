import { getErrorMessage } from '@/utils/types/errors';

export function isAtracePermissionError(error: unknown, permission?: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (permission && message.includes(`missing permission ${permission}`.toLowerCase())) {
    return true;
  }
  return message.includes('missing permission') || message.includes('access denied') || message.includes('unauthorized');
}
