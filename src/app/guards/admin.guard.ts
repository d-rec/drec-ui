import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const AdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  try {
    const user = JSON.parse(sessionStorage.getItem('loginuser') ?? 'null');
    if (user?.role === 'Admin') return true;
  } catch { /* ignore */ }
  router.navigate(['/dashboard']);
  return false;
};
