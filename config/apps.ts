export type AppConfig = {
  name: string; // official app name (e.g., 'A-Trace')
  bundle: string;        // system bundle name (e.g., pieceowater.atrace)
  address: string;       // nuxt route segment (e.g., 'atrace')
  icon: string;          // icon name (UIcon compatible)
  titleKey: string;      // i18n key for title (e.g., app.attendance)
  descriptionKey: string;// i18n key for description (e.g., app.attendanceDesc)
  canAdd: boolean;       // false if still under development (coming soon)
};

export const ALL_APPS: AppConfig[] = [
  {
    name: 'lota A-Trace',
    bundle: 'pieceowater.atrace',
    address: 'atrace',
    icon: 'i-lucide-qr-code',
    titleKey: 'app.attendance',
    descriptionKey: 'app.attendanceDesc',
    canAdd: true,
  },
  {
    name: 'lota Issues',
    bundle: 'pieceowater.tasks',
    address: 'tasks',
    icon: 'i-lucide-clipboard-check',
    titleKey: 'app.tasks',
    descriptionKey: 'app.tasksDesc',
    canAdd: false,
  },
  {
    name: 'lota Clients',
    bundle: 'pieceowater.clients',
    address: 'clients',
    icon: 'i-lucide-briefcase',
    titleKey: 'app.clients',
    descriptionKey: 'app.clientsDesc',
    canAdd: false,
  },
  {
    name: 'lota Routes',
    bundle: 'pieceowater.routes',
    address: 'routes',
    icon: 'i-lucide-route',
    titleKey: 'app.routes',
    descriptionKey: 'app.routesDesc',
    canAdd: false,
  },
  {
    name: 'lota Reports',
    bundle: 'pieceowater.reports',
    address: 'reports',
    icon: 'i-lucide-file-text',
    titleKey: 'app.reports',
    descriptionKey: 'app.reportsDesc',
    canAdd: false,
  },
  {
    name: 'lota Calls',
    bundle: 'pieceowater.calls',
    address: 'calls',
    icon: 'i-lucide-headset',
    titleKey: 'app.calls',
    descriptionKey: 'app.callsDesc',
    canAdd: false,
  },
];
