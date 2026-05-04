import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const ChatReviewGuard: CanActivateFn = () => {
  const router = inject(Router);
  try {
    const user = JSON.parse(sessionStorage.getItem('loginuser') ?? 'null');
    const allowed = ['Admin', 'SeniorReviewer'];
    if (user?.role && allowed.includes(user.role)) return true;
  } catch {
    /* ignore */
  }
  router.navigate(['/dashboard']);
  return false;
};
