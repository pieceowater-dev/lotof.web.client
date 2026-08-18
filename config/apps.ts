export type AppConfig = {
  name: string; // official app name (e.g., 'A-Trace')
  bundle: string;        // system bundle name (e.g., pieceowater.atrace)
  address: string;       // nuxt route segment (e.g., 'atrace')
  icon: string;          // icon name (UIcon compatible)
  titleKey: string;      // i18n key for title (e.g., app.attendance)
  descriptionKey: string;// i18n key for description (e.g., app.attendanceDesc)
  canAdd: boolean;       // false if still under development (coming soon)
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
    canAdd: false,
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
    name: 'lota Sales',
    bundle: 'pieceowater.sales',
    address: 'sales',
    icon: 'lucide:store',
    titleKey: 'app.sales',
    descriptionKey: 'app.salesDesc',
    canAdd: false,
  },
  {
    name: 'lota Calls',
    bundle: 'pieceowater.calls',
    address: 'calls',
  icon: 'lucide:headset',
    titleKey: 'app.calls',
    descriptionKey: 'app.callsDesc',
    canAdd: false,
  },
];
