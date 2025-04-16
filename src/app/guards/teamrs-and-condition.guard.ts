import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { UserService } from '../auth/services/user.service';
import { firstValueFrom } from 'rxjs';

export const termsAndConditionsGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Promise<boolean> => {
  const router = inject(Router);
  const userService = inject(UserService);
  const user = JSON.parse(sessionStorage.getItem('loginuser') || 'null');

  if (!user) {
    await router.navigate(['/login']);
    return false;
  }

  try {
    const userData = await firstValueFrom(userService.getuserById(user.id));

    if (userData.terms_accept_at === null) {
      sessionStorage.setItem('redirectUrl', state.url);
      await router.navigate(['/terms-and-conditions']);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error fetching user:', err);
    await router.navigate(['/login']);
    return false;
  }
};
