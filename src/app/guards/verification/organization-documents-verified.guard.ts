import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from '../auth.guard';
import { UserService } from '../../auth/services/user.service';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';

export const OrganizationDocumentsGuard: CanActivateFn = (_route, _state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.userProfile().pipe(
    map((user) => {
      if (user.organization?.verifiedAt) {
        return router.parseUrl('/dashboard');
      }

      return true;
    }),
  );
};
