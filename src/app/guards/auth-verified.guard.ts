import { CanActivateFn } from '@angular/router';
import { AuthGuard } from './auth.guard';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  const result = AuthGuard(route, state);

  if (result !== true) {
    return result;
  }

  // Additional access checks can go here
  return true;
};
