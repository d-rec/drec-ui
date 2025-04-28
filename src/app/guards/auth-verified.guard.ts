import { CanActivateFn } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { inject } from '@angular/core';
import { UserService } from '../auth/services/user.service';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  // Additional access checks can go here
  userService.userProfile().subscribe({
    next: (data) => {
      if (data.terms_accept_at === null) {
        window.location.href = '/accept-terms-and-conditions';
      }
    },
  });

  return true;
};
