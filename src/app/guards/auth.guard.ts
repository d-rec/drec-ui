import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthbaseService } from '../auth/authbase.service';
import { Router } from '@angular/router';
import { checkLoggedIn } from '../utils/authentication-check';

export const AuthGuard: CanActivateFn = () => {
  const authService = inject(AuthbaseService);
  const router = inject(Router);
  return checkLoggedIn(authService, router);
};
