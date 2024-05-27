import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
} from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const authorizationToken = sessionStorage.getItem('access-token');
    if (authorizationToken) {
      request = request.clone({
        setHeaders: {
          Authorization: 'Bearer ' + authorizationToken,
        },
      });
    }
    return next.handle(request).pipe(
      tap((response) => {
        if (response instanceof HttpResponse) {
          if (response.status == 401) {
            // this.sharedService.showToastMessages('info', 'Your session timedout, you have been logged out');
            // this.router.navigate(['login']);
          }
        }
      }),
      catchError((err: string) => this.handleHttpClientError(err)),
    );
  }
  handleHttpClientError(error: any) {
    if (error.status == 401) {
      // this.tokenHandlingService.removeTokenFromStorage();
      // this.sharedService.showToastMessages('info', 'Your session has been timed out, you have been logged out');
      // this.router.navigate(['login']);
    }
    return throwError(error);
  }
}
