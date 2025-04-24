import { CanActivateFn } from '@angular/router';
import { AuthGuard } from './auth.guard';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  // const router = inject(Router);

  // Additional access checks can go here

  // if (user.emailVerifiedAt === null) {
  //   router.navigate(['/confirm-email']);
  // }

  return true;
};
