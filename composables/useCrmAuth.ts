import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';

/** Resolves the Contacts app token + namespace for one API call. */
export function useCrmAuth() {
  const { token } = useAuth();
  const { ensure } = useContactsToken();
  const { selected } = useNamespace();

  async function ctx(): Promise<{ token: string; ns: string } | null> {
    if (!token.value || !selected.value) return null;
    const contactsToken = await ensure(selected.value, token.value);
    if (!contactsToken) return null;
    return { token: contactsToken, ns: selected.value };
  }

  return { ctx };
}
