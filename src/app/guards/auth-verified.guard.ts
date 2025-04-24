import { CanActivateFn, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { UserService } from '../auth/services/user.service';
import { inject } from '@angular/core';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { DocumentsUploadService } from '../auth/services/documents-upload.service';

export const AuthVerifiedGuard: CanActivateFn = (route, state) => {
  // First check if user is logged in
  const loggedInResult = AuthGuard(route, state);

  // If the first check returns false or a UrlTree, return that result
  if (loggedInResult !== true) {
    return loggedInResult;
  }

  const router = inject(Router);
  const userService = inject(UserService);
  const documentService = inject(DocumentsUploadService);

  return userService.userProfile().pipe(
    switchMap((user: any) => {
      if (user.organization.verifiedAt === null) {
        return documentService.getDocumentUploads().pipe(
          map((uploadedDocuments: any) => {
            if (uploadedDocuments.length === 4) {
              return router.createUrlTree(['/wait-verification']);
            } else {
              return router.createUrlTree(['/documents-upload']);
            }
          }),
        );
      }
      return of(true);
    }),
  );
};
