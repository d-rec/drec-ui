export function getRoleName(role: string): string {
  if (role === 'SeniorReviewer') return 'Senior Reviewer';
  if (role === 'SiteOperator') return 'Site Operator';
  if (role === 'MarketIntermediary') return 'Registrant';
  if (role === 'OrganizationAdmin') return 'Registrant';
  if (role === 'DeviceOwner') return 'Site Operator';
  return role;
}

export function getOrgTypeName(type: string): string {
  if (type === 'SiteOperator') return 'Site Operator';
  if (type === 'MarketIntermediary') return 'Registrant';
  return type;
}
