import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Block Reviewer and SeniorReviewer roles from a route. Used on
 * pages that are not part of the review workflow (e.g., D-REC Tokens,
 * device management, registrant lists). The sidemenu already hides
 * those entries, but a guard is required so a typed URL doesn't
 * bypass the restriction.
 */
export const NonReviewerGuard: CanActivateFn = () => {
  const router = inject(Router);
  try {
    const user = JSON.parse(sessionStorage.getItem('loginuser') ?? 'null');
    if (
      user?.role &&
      user.role !== 'Reviewer' &&
      user.role !== 'SeniorReviewer'
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  router.navigate(['/dashboard']);
  return false;
};
