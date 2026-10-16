export type AppConfig = {
  name: string; // official app name (e.g., 'A-Trace')
  bundle: string;        // system bundle name (e.g., pieceowater.atrace)
  address: string;       // nuxt route segment (e.g., 'atrace')
  icon: string;          // icon name (UIcon compatible)
  titleKey: string;      // i18n key for title (e.g., app.attendance)
  descriptionKey: string;// i18n key for description (e.g., app.attendanceDesc)
  canAdd: boolean;       // false if still under development (coming soon)
};

// lota Pages (site builder) is not released yet: its bundle is not registered in Hub/Capital billing and the
// backend is not deployed. It is visible only in local development, or in a build made with
// VITE_PAGES_ENABLED=true (e.g. a staging environment). Everywhere else the app does not exist for users:
// no header tab, no hub tile, and its routes redirect home (see middleware/pages-gate.global.ts).
export const PAGES_ENABLED = import.meta.dev || import.meta.env.VITE_PAGES_ENABLED === 'true';

const PAGES_APP: AppConfig = {
  name: 'lota Pages',
  bundle: 'pieceowater.pages',
  address: 'pages',
  icon: 'lucide:panels-top-left',
  titleKey: 'app.pages',
  descriptionKey: 'app.pagesDesc',
  // The entry exists only where PAGES_ENABLED (dev/staging); there it is fully open, not a "coming soon" tile.
  canAdd: true,
};

// Order here drives both the header nav buttons and the home dashboard tiles
// (see AppHeader.vue's navApps and pages/index.vue's dashboardApps) -- keep
// it as the single source of truth for app ordering across the frontend.
export const ALL_APPS: AppConfig[] = [
  {
    name: 'lota Issues',
    bundle: 'pieceowater.issues',
    address: 'issues',
  icon: 'lucide:clipboard-check',
    titleKey: 'app.tasks',
    descriptionKey: 'app.tasksDesc',
    canAdd: true,
  },
  {
    name: 'lota Orders',
    bundle: 'pieceowater.menu',
    address: 'menu',
    icon: 'lucide:receipt-text',
    titleKey: 'app.menu',
    descriptionKey: 'app.menuDesc',
    canAdd: true,
  },
  {
    name: 'lota Contacts',
    bundle: 'pieceowater.contacts',
    address: 'contacts',
  icon: 'lucide:briefcase',
    titleKey: 'app.clients',
    descriptionKey: 'app.clientsDesc',
    canAdd: true,
  },
  {
    name: 'lota A-Trace',
    bundle: 'pieceowater.atrace',
    address: 'atrace',
  icon: 'lucide:qr-code',
    titleKey: 'app.attendance',
    descriptionKey: 'app.attendanceDesc',
    canAdd: true,
  },
  {
    name: 'lota Goods',
    bundle: 'pieceowater.goods',
    address: 'goods',
    icon: 'lucide:package',
    titleKey: 'app.goods',
    descriptionKey: 'app.goodsDesc',
    canAdd: true, // LOCAL-ONLY, uncommitted: flipped for the local browser test session
  },
  // Temporarily out of the lineup — not implemented yet and not currently
  // planned for the near term. Left here (not deleted) so re-adding one is
  // just uncommenting rather than re-authoring the whole entry.
  // {
  //   name: 'lota Links',
  //   bundle: 'pieceowater.links',
  //   address: 'links',
  //   icon: 'lucide:link',
  //   titleKey: 'app.links',
  //   descriptionKey: 'app.linksDesc',
  //   canAdd: false,
  // },
  // {
  //   name: 'lota Schedules',
  //   bundle: 'pieceowater.schedules',
  //   address: 'schedules',
  //   icon: 'lucide:calendar',
  //   titleKey: 'app.schedules',
  //   descriptionKey: 'app.schedulesDesc',
  //   canAdd: false,
  // },
  // {
  //   name: 'lota Routes',
  //   bundle: 'pieceowater.routes',
  //   address: 'routes',
  //   icon: 'lucide:route',
  //   titleKey: 'app.routes',
  //   descriptionKey: 'app.routesDesc',
  //   canAdd: false,
  // },
  // {
  //   name: 'lota Reports',
  //   bundle: 'pieceowater.reports',
  //   address: 'reports',
  //   icon: 'lucide:file-text',
  //   titleKey: 'app.reports',
  //   descriptionKey: 'app.reportsDesc',
  //   canAdd: false,
  // },
  {
    name: 'lota Plans',
    bundle: 'pieceowater.plans',
    address: 'plans',
    icon: 'lucide:calendar-check',
    titleKey: 'app.plans',
    descriptionKey: 'app.plansDesc',
    canAdd: true,
  },
  // lota Pages is hidden everywhere (header, hub tiles, routes) unless PAGES_ENABLED (see above).
  ...(PAGES_ENABLED ? [PAGES_APP] : []),
];

// Brand gradient per app (hub tiles and the mobile burger menu share it).
export const APP_GRADIENTS: Record<string, [string, string]> = {
  console: ['#475569', '#0f172a'],
  issues: ['#3b82f6', '#6366f1'],
  menu: ['#fbbf24', '#f97316'],
  contacts: ['#a78bfa', '#d946ef'],
  atrace: ['#22d3ee', '#2563eb'],
  goods: ['#34d399', '#0d9488'],
  plans: ['#fb7185', '#f43f5e'],
  pages: ['#38bdf8', '#10b981'],
};

export function appIconStyle(key: string) {
  const [from, to] = APP_GRADIENTS[key] || ['#3b82f6', '#10b981'];
  return { backgroundImage: `linear-gradient(145deg, ${from}, ${to})` };
}
