import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { AuthbaseService } from '../authbase.service';

@Injectable({
  providedIn: 'root',
})
export class ValidationGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private authService: AuthbaseService,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    if (!this.authService.isLoggedIn()) {
      return of(this.router.createUrlTree(['/login']));
    }

    return this.userService.userProfile().pipe(
      map((user) => {
        if (user.organization.verifiedAt === null) {
          return this.router.createUrlTree(['/documents-upload']);
        }

        return true;
      }),
    );
  }
}
