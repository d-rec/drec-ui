import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../../auth/services/user.service';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';

export const PhoneVerificationGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.userProfile().pipe(
    map((user) => {
      if (user.phoneNumberVerifiedAt) {
        return router.parseUrl('/dashboard');
      }

      return true;
    }),
  );
};
