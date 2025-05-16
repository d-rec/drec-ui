import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { UserService } from '../auth/services/user.service';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  // Additional access checks can go here
  return userService.userProfile().pipe(
    map((user) => {
      if (!user.termsAcceptedAt) {
        return router.createUrlTree(['/accept-terms-and-conditions']);
      }

      if (!user.emailVerifiedAt) {
        return router.createUrlTree(['/resend-confirmation-email']);
      }

      if (!user.phoneNumberVerifiedAt) {
        return router.createUrlTree(['/verify-otp']);
      }

      if (!user.organization.verifiedAt) {
        return router.createUrlTree([
          '/Organization/upload/verification-documents',
        ]);
      }

      return true;
    }),
  );
};
