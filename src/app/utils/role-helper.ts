export function getRoleName(role: string): string {
  if (role === 'MarketIntermediary') return 'Market Intermediary';
  if (role === 'OrganizationAdmin') return 'Developer';
  if (role === 'SeniorReviewer') return 'Senior Reviewer';
  return role;
}

export function getOrgTypeName(type: string): string {
  if (type === 'MarketIntermediary') return 'Market Intermediary';
  return type;
}
