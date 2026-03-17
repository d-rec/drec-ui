export function getRoleName(role: string): string {
  if (role === 'ApiUser') return 'Market Intermediary';
  if (role === 'OrganizationAdmin') return 'Developer';
  return role;
}

export function getOrgTypeName(type: string): string {
  if (type === 'ApiUser') return 'Market Intermediary';
  return type;
}
