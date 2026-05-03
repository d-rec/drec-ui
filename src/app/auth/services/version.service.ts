import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

export interface AppVersion {
  buildTime: string;
  sha: string;
  environment: string;
  version?: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private cached$: Observable<AppVersion | null> | null = null;

  constructor(private http: HttpClient) {}

  get(): Observable<AppVersion | null> {
    if (!this.cached$) {
      this.cached$ = this.http.get<AppVersion>('/version.json').pipe(
        catchError(() => of(null)),
        shareReplay(1),
      );
    }
    return this.cached$;
  }
}
