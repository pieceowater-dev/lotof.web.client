import { computed } from 'vue';
import { ALL_APPS } from '@/config/apps';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';

type Part = string | undefined | null | false;

/**
 * Browser-tab title for a namespace page: «Section — Subject — App — Workspace».
 * Every part comes from i18n or live data, so the tab is always in the
 * interface language (never a hardcoded word or a route slug).
 * `section` is a `pageTitle.*` key; `subject` is a live name (board, client).
 */
export function usePageTitle(
  appAddress: string,
  opts: { section?: string; subject?: () => Part } = {},
) {
  const route = useRoute();
  const { t } = useI18n();
  const { titleBySlug } = useNamespace();
  const title = computed(() => {
    const app = ALL_APPS.find((a) => a.address === appAddress);
    const ns = route.params.namespace as string | undefined;
    const parts: Part[] = [
      opts.section ? t(`pageTitle.${opts.section}`) : '',
      opts.subject?.(),
      app ? t(app.titleKey) || app.name : '',
      (ns && (titleBySlug(ns) || ns)) || '',
    ];
    return parts.filter(Boolean).join(' — ') || t('app.title') || 'lota';
  });
  useHead(() => ({ title: title.value }));
  return title;
}
