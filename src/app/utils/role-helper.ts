export function getRoleName(role: string): string {
  if (role === 'ApiUser') return 'Market Intermediary';
  if (role === 'OrganizationAdmin') return 'Developer';
  return role;
}
