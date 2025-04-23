import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthbaseService } from '../auth/authbase.service';
import { Router } from '@angular/router';
import { checkLoggedIn } from '../utils/authentication-check';

export const AuthVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthbaseService);
  const router = inject(Router);
  if (!checkLoggedIn(authService, router)) {
    return false;
  }
  // additional access checks  will be added here
  return true;
};
