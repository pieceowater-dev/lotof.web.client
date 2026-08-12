// A member's nickname is a per-namespace override an owner can set (see
// hub.msvc.namespaces SetMemberNickname) -- mainly to replace whatever a
// person's Google account happened to be named (e.g. "mcloving69") with
// something presentable for their team. Falls back to the account username
// whenever no nickname is set for this namespace.
export function memberDisplayName(member: { username?: string | null; nickname?: string | null } | null | undefined): string {
  if (!member) return '';
  const nickname = member.nickname?.trim();
  return nickname || member.username || '';
}
