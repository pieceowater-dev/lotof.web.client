import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS } from '@/config/apps';
import { GUIDE_APP_IDS, guideAppFromParam, guideAppToParam } from '@/composables/useGuideContext';
import { guideListArticles } from '@/api/guide/public';
import type { GuideApp, GuideArticleListItem } from '@/api/guide/public';

// Same per-product gradients as the hub launcher, so a product looks the
// same in the Гид as it does on the workspace home.
const GRADIENTS: Record<string, [string, string]> = {
  issues: ['#3b82f6', '#6366f1'],
  menu: ['#fbbf24', '#f97316'],
  contacts: ['#a78bfa', '#d946ef'],
  atrace: ['#22d3ee', '#2563eb'],
  goods: ['#34d399', '#0d9488'],
  plans: ['#fb7185', '#f43f5e'],
  global: ['#2563eb', '#10b981'],
  landing: ['#38bdf8', '#2563eb'],
};

export type GuideEntry = {
  param: string;
  app: GuideApp;
  label: string;
  description: string;
  icon: string;
  gradient: [string, string];
};

type Suffix = 'Ru' | 'Kk' | 'En';

export function useGuideApps() {
  const { t, locale } = useI18n();

  const entries = computed<GuideEntry[]>(() => [
    ...GUIDE_APP_IDS.map((id) => {
      const app = ALL_APPS.find((a) => a.address === id);
      return {
        param: id as string,
        app: guideAppFromParam(id) as GuideApp,
        label: app ? t(app.titleKey) : id,
        description: app ? t(app.descriptionKey) : '',
        icon: app?.icon || 'lucide:layout-grid',
        gradient: GRADIENTS[id],
      };
    }),
    { param: guideAppToParam('GLOBAL'), app: 'GLOBAL' as GuideApp, label: t('guide.appGlobal'), description: t('guide.globalDesc'), icon: 'lucide:help-circle', gradient: GRADIENTS.global },
    { param: guideAppToParam('LANDING'), app: 'LANDING' as GuideApp, label: t('guide.appLanding'), description: t('guide.landingDesc'), icon: 'lucide:home', gradient: GRADIENTS.landing },
  ]);

  const entryByParam = (param: string) => entries.value.find((e) => e.param === param.toLowerCase()) || null;

  const suffix = (): Suffix => (locale.value === 'kk' ? 'Kk' : locale.value === 'en' ? 'En' : 'Ru');

  /** Localised field of an article/category with a Russian fallback. */
  function field(item: unknown, base: string): string {
    const rec = item as Record<string, string>;
    return rec[`${base}${suffix()}`] || rec[`${base}Ru`] || '';
  }

  /** "1 статья / 2 статьи / 5 статей" in the active language. */
  function articleCount(n: number): string {
    if (locale.value === 'en') return `${n} ${n === 1 ? 'article' : 'articles'}`;
    if (locale.value === 'kk') return `${n} мақала`;
    const m10 = n % 10;
    const m100 = n % 100;
    const word = m10 === 1 && m100 !== 11 ? 'статья' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'статьи' : 'статей';
    return `${n} ${word}`;
  }

  return { entries, entryByParam, field, articleCount };
}

export function guideGradientStyle(gradient: [string, string]) {
  return { backgroundImage: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})` };
}

/** Published articles of every product (search index + counts for /guide). */
export async function loadAllGuideArticles(): Promise<Record<string, GuideArticleListItem[]>> {
  const params = [...GUIDE_APP_IDS, 'global', 'landing'] as string[];
  const out: Record<string, GuideArticleListItem[]> = {};
  await Promise.all(params.map(async (p) => {
    const app = guideAppFromParam(p);
    try {
      out[p] = app ? await guideListArticles(app) : [];
    } catch {
      out[p] = [];
    }
  }));
  return out;
}
