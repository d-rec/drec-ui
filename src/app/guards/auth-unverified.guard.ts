import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { inject } from '@angular/core';
import { UserService } from '../auth/services/user.service';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const isVerified = (user: any) => {
  return (
    user.termsAcceptedAt &&
    user.emailVerifiedAt &&
    user.phoneNumberVerifiedAt &&
    user.organization.verifiedAt
  );
};

export const AuthUnverifiedGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  // In dev/stage, always treat user as verified — redirect to dashboard
  if (!environment.production) {
    return router.createUrlTree(['/dashboard']);
  }

  // Additional access checks can go here
  return userService.userProfile().pipe(
    map((user) => {
      if (isVerified(user)) {
        return router.createUrlTree(['/dashboard']);
      }

      return true;
    }),
  );
};
