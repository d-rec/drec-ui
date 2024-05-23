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
    const authorizationToken = sessionStorage.getItem('token');
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
      catchError((err: string) =>
        this.handleHttpClientError(err),
      ),
    );
  }

  handleHttpClientError(error: any) {
    // this.sharedService.stopLoader();
    if (error.status == 401) {
      // Handle unauthorized error
    //  this.authService.logout(); // Example: log the user out
      this.router.navigate(['/login']); // Example: redirect to login page
    }
    return throwError(error);
  }
}
