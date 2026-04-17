import type { TourConfig } from '@/composables/useOnboarding';

export const atraceTour: TourConfig = {
  id: 'atrace-intro',
  steps: [
    {
      id: 'welcome',
      target: '[data-tour="atrace-title"]',
      titleKey: 'app.tourAtraceWelcomeTitle',
      contentKey: 'app.tourAtraceWelcomeContent',
      placement: 'bottom',
      highlightPadding: 12,
    },
    {
      id: 'create-post',
      target: [
        '[data-tour="create-post-btn"]',
        '[data-tour="create-post-btn-mobile"]',
        '[data-tour="create-post-btn-empty"]',
      ],
      titleKey: 'app.tourAtraceCreateTitle',
      contentKey: 'app.tourAtraceCreateContent',
      placement: 'left',
      highlightPadding: 12,
    },
    {
      id: 'posts-list',
      target: [
        '[data-tour="posts-list"]',
        '[data-tour="posts-list-mobile"]',
      ],
      titleKey: 'app.tourAtracePostsTitle',
      contentKey: 'app.tourAtracePostsContent',
      placement: 'bottom',
      highlightPadding: 8,
    },
    {
      id: 'attendance-table',
      target: '[data-tour="attendance-table"]',
      titleKey: 'app.tourAtraceTableTitle',
      contentKey: 'app.tourAtraceTableContent',
      placement: 'top',
      highlightPadding: 8,
    },
    {
      id: 'calculate',
      target: '[data-tour="calculate-btn"]',
      titleKey: 'app.tourAtraceCalculateTitle',
      contentKey: 'app.tourAtraceCalculateContent',
      placement: 'right',
      highlightPadding: 8,
    },
    {
      id: 'settings',
      target: '[data-tour="settings-btn"]',
      titleKey: 'app.tourAtraceSettingsTitle',
      contentKey: 'app.tourAtraceSettingsContent',
      placement: 'bottom',
      highlightPadding: 12,
    },
    {
      id: 'help-button',
      target: '[data-tour="help-button"]',
      titleKey: 'app.tourAtraceHelpTitle',
      contentKey: 'app.tourAtraceHelpContent',
      placement: 'bottom',
      highlightPadding: 8,
    },
  ],
};

export const contactsTour: TourConfig = {
  id: 'contacts-intro',
  steps: [
    {
      id: 'welcome',
      target: '[data-tour="contacts-title"]',
      titleKey: 'app.tourContactsWelcomeTitle',
      contentKey: 'app.tourContactsWelcomeContent',
      placement: 'bottom',
      highlightPadding: 12,
    },
    {
      id: 'type-filter',
      target: '[data-tour="contacts-type-filter"]',
      titleKey: 'app.tourContactsFilterTitle',
      contentKey: 'app.tourContactsFilterContent',
      placement: 'bottom',
      highlightPadding: 10,
    },
    {
      id: 'create-client',
      target: [
        '[data-tour="contacts-create-btn"]',
        '[data-tour="contacts-create-empty"]',
      ],
      titleKey: 'app.tourContactsCreateTitle',
      contentKey: 'app.tourContactsCreateContent',
      placement: 'left',
      highlightPadding: 10,
    },
    {
      id: 'clients-table',
      target: [
        '[data-tour="contacts-table-search"]',
        '[data-tour="contacts-table"]',
        '[data-tour="contacts-empty-state"]',
      ],
      titleKey: 'app.tourContactsTableTitle',
      contentKey: 'app.tourContactsTableContent',
      placement: 'top',
      highlightPadding: 8,
    },
    {
      id: 'settings',
      target: '[data-tour="contacts-settings-btn"]',
      titleKey: 'app.tourContactsSettingsTitle',
      contentKey: 'app.tourContactsSettingsContent',
      placement: 'bottom',
      highlightPadding: 10,
    },
    {
      id: 'help-button',
      target: '[data-tour="help-button"]',
      titleKey: 'app.tourContactsHelpTitle',
      contentKey: 'app.tourContactsHelpContent',
      placement: 'bottom',
      highlightPadding: 8,
    },
  ],
};
