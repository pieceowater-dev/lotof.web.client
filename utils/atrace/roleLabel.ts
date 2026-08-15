// The three default roles every namespace's Atrace tenant is seeded with
// (see role.seeder.go in lotof.atrace.msvc.tracker) are stored/returned by
// the backend with fixed English names -- a namespace can also create its
// own custom roles via the Settings page, which keep whatever name the
// owner typed. Only the three known defaults get translated; anything else
// passes through unchanged since there's no way to know what language (if
// any) a custom name should be in.
const DEFAULT_ROLE_KEYS: Record<string, string> = {
  Teammate: 'app.atraceRoleTeammate',
  Manager: 'app.atraceRoleManager',
  Admin: 'app.atraceRoleAdmin',
};

export function atraceRoleLabel(name: string | null | undefined, t: (key: string) => string): string {
  if (!name) return '';
  const key = DEFAULT_ROLE_KEYS[name];
  if (!key) return name;
  return t(key) || name;
}

// Only the three seeded defaults get a description -- a custom role's scope
// depends entirely on whatever permissions its owner picked for it, so
// there's nothing generic and true to say about it here.
const DEFAULT_ROLE_DESC_KEYS: Record<string, string> = {
  Teammate: 'app.atraceRoleTeammateDesc',
  Manager: 'app.atraceRoleManagerDesc',
  Admin: 'app.atraceRoleAdminDesc',
};

export function atraceRoleDescription(name: string | null | undefined, t: (key: string) => string): string {
  if (!name) return '';
  const key = DEFAULT_ROLE_DESC_KEYS[name];
  return key ? t(key) : '';
}
