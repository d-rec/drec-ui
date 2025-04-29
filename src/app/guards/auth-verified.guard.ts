import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { UserService } from '../auth/services/user.service';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  const router = inject(Router);
  const userService = inject(UserService);

  return userService.userProfile().pipe(
    map((user) => {
      if (!user.emailVerifiedAt) {
        return router.createUrlTree(['/resend-confirmation-email']);
      }
      if (user.organization.verifiedAt === null) {
        return router.createUrlTree(['/documents-upload']);
      }

      return true;
    }),
  );
};
