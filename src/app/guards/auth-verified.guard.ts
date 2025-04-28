import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { UserService } from '../auth/services/user.service';
import { inject } from '@angular/core';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  const userService = inject(UserService);
  const router = inject(Router);
  userService.userProfile().subscribe({
    next: (data) => {
      if (!data.phone_number_verified_at) {
        router.navigate(['/verify-otp']);
      }
    },
  });
  // Additional access checks can go here
  // if (user.emailVerifiedAt === null) {
  //   router.navigate(['/confirm-email']);
  // }

  return true;
};
