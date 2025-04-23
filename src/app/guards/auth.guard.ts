import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthbaseService } from '../auth/authbase.service';
import { Router } from '@angular/router';

export const AuthGuard: CanActivateFn = () => {
  const authService = inject(AuthbaseService);
  const router = inject(Router);
  if (authService.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
