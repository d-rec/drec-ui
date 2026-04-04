export function getRoleName(role: string): string {
  if (role === 'MarketIntermediary') return 'Market Intermediary';
  if (role === 'OrganizationAdmin') return 'Organization Admin';
  if (role === 'SeniorReviewer') return 'Senior Reviewer';
  if (role === 'SiteOperator') return 'Site Operator';
  return role;
}

export function getOrgTypeName(type: string): string {
  if (type === 'MarketIntermediary') return 'Market Intermediary';
  if (type === 'Developer') return 'Organization Admin';
  if (type === 'SiteOperator') return 'Site Operator';
  return type;
}
