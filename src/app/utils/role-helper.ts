export function getUserRoleDisplay(role: string): string {
  return role === 'ApiUser' ? 'Market Intermediary' : role;
}
