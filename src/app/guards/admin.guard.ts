import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const AdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  try {
    const user = JSON.parse(sessionStorage.getItem('loginuser') ?? 'null');
    const allowed = [
      'Admin',
      'OrganizationAdmin',
      'ApiUser',
      'Reviewer',
      'SeniorReviewer',
    ];
    if (user?.role && allowed.includes(user.role)) return true;
  } catch {
    /* ignore */
  }
  router.navigate(['/dashboard']);
  return false;
};
