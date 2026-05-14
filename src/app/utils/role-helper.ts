export function getRoleName(role: string): string {
  if (role === 'SeniorReviewer') return 'Senior Reviewer';
  if (role === 'SiteOperator') return 'Site Operator';
  if (role === 'MarketIntermediary') return 'Registrant';
  if (role === 'OrganizationAdmin') return 'Registrant';
  if (role === 'DeviceOwner') return 'Site Operator';
  return role;
}

export function isInternalReviewerRole(role: string | undefined | null): boolean {
  return role === 'Admin' || role === 'Reviewer' || role === 'SeniorReviewer';
}

export function currentUserIsInternalReviewer(): boolean {
  try {
    const u = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    return isInternalReviewerRole(u?.role);
  } catch {
    return false;
  }
}

export function getOrgTypeName(type: string): string {
  if (type === 'SiteOperator') return 'Site Operator';
  if (type === 'MarketIntermediary') return 'Registrant';
  return type;
}
