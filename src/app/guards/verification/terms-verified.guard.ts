import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from '../auth.guard';
import { UserService } from '../../auth/services/user.service';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';

export const TermsVerificationGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  const loggedInResult = AuthGuard(route, state);
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  return userService.userProfile().pipe(
    map((user) => {
      if (user.termsAcceptedAt) {
        return router.parseUrl('/dashboard');
      }

      return true;
    }),
  );
};
