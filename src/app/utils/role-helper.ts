export function getRoleName(role: string): string {
  if (role === 'ApiUser') return 'Market Intermediary';
  if (role === 'OrganizationAdmin') return 'Developer';
  if (role === 'SeniorReviewer') return 'Senior Reviewer';
  return role;
}

export function getOrgTypeName(type: string): string {
  if (type === 'ApiUser') return 'Market Intermediary';
  return type;
}
