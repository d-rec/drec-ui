import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { AuthbaseService } from '../authbase.service';
import { DocumentsUploadService } from '../services/documents-upload.service';
@Injectable({
  providedIn: 'root',
})
export class ValidationGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private authService: AuthbaseService,
    private router: Router,
    private documentService: DocumentsUploadService,
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    if (!this.authService.isLoggedIn()) {
      return of(this.router.createUrlTree(['/login']));
    }

    return this.userService.userProfile().pipe(
      switchMap((user) => {
        if (user.organization.verifiedAt === null) {
          return this.documentService.getDocumentUploads().pipe(
            map((documents: any) => {
              if (documents.length === 4) {
                return this.router.createUrlTree(['/wait-verification']);
              }
              return this.router.createUrlTree(['/documents-upload']);
            }),
          );
        }
        return of(true);
      }),
    );
  }
}
