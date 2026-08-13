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

// Same nickname-first precedence as memberDisplayName, but for the many
// call sites (attendance tables, coverage/leave banners, order
// participants, staff lists, ...) that additionally want to fall back to
// an email or raw ID rather than show nothing when a member has neither a
// nickname nor a username on file. Kept as a separate function rather than
// changing memberDisplayName itself, since that one's callers rely on its
// current "blank if neither" contract. Previously each of these call sites
// retyped its own `nickname || username || email` chain, with small,
// inconsistent variations in what came after username -- so the same
// member could display differently depending on which screen rendered
// them.
export function memberDisplayNameWithFallback(
  member: { username?: string | null; nickname?: string | null } | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  const primary = memberDisplayName(member);
  if (primary) return primary;
  for (const f of fallbacks) {
    const trimmed = f?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}
