export type DowngradeRegression = { key: string; from: number; to: number };

const FEATURE_LABEL_KEYS: Record<string, string> = {
  max_employees: 'app.limitEmployees',
  max_posts: 'app.limitPosts',
  max_clients: 'app.limitActiveUsers',
  max_custom_fields: 'app.limitCustomFields',
  max_loyalty_programs: 'app.limitLoyaltyPrograms',
  max_staff: 'app.limitStaff',
  max_branches: 'app.limitBranches',
  max_menu_items: 'app.limitMenuItems',
  max_promobanners: 'app.limitPromobanners',
  max_badges: 'app.limitBadges',
  max_links: 'app.limitLinks',
};

export function featureLabelKey(featureKey: string): string {
  return FEATURE_LABEL_KEYS[featureKey] || featureKey;
}

// Backend error looks like:
// "downgrade not allowed: new plan lowers limits the current plan already
// allows (max_badges: 30 -> 10, max_branches: 5 -> 1). Choose a plan..."
// Pulls the "(key: from -> to, ...)" part out into structured rows.
export function parseDowngradeRegressions(errorMessage: string): DowngradeRegression[] | null {
  if (!errorMessage.includes('downgrade not allowed')) return null;

  const listMatch = errorMessage.match(/\(([^)]+)\)/);
  if (!listMatch) return null;

  const regressions: DowngradeRegression[] = [];
  for (const part of listMatch[1].split(',')) {
    const rowMatch = part.trim().match(/^(\w+):\s*(\d+)\s*->\s*(\d+)$/);
    if (!rowMatch) continue;
    regressions.push({ key: rowMatch[1], from: Number(rowMatch[2]), to: Number(rowMatch[3]) });
  }

  return regressions.length ? regressions : null;
}

export function useDowngradeBlockedModal() {
  const isOpen = useState<boolean>('downgrade_blocked_modal_open', () => false);
  const regressions = useState<DowngradeRegression[]>('downgrade_blocked_modal_regressions', () => []);

  function open(rows: DowngradeRegression[]) {
    regressions.value = rows;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  return { isOpen, regressions, open, close };
}
