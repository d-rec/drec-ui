import { AuthbaseService } from '../auth/authbase.service';
import { Router } from '@angular/router';

export function checkLoggedIn(
  authService: AuthbaseService,
  router: Router,
): boolean {
  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
}
