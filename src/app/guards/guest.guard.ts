import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthbaseService } from '../auth/authbase.service';
import { Router } from '@angular/router';

export const GuestGuard: CanActivateFn = () => {
  const authService = inject(AuthbaseService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
