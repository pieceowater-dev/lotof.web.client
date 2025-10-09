// Permission / role helper (draft)
// Extend later when backend returns roles & permissions.
interface UserWithRoles { roles?: string[] }

export function useCan() {
  const { user } = useAuth();

  function hasRole(role: string) {
    return !!user.value && Array.isArray((user.value as UserWithRoles).roles) && (user.value as UserWithRoles).roles!.includes(role);
  }

  // Placeholder: map permissions → roles
  function can(permission: string) {
    // Later define mapping (e.g. const matrix = { 'post.create': ['ADMIN','EDITOR'] })
    // return matrix[permission]?.some(r => hasRole(r)) ?? false;
    return hasRole(permission); // temporary simplistic fallback
  }

  return { hasRole, can };
}
