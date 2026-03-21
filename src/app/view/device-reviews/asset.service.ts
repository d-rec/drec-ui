import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, ReplaySubject, map } from 'rxjs';
import { Asset } from './asset.model';
import { environment } from '../../../environments/environment';

@Injectable()
export class AssetService {
  readonly assets$ = new BehaviorSubject<Asset[]>([]);
  readonly selectedId$ = new BehaviorSubject<string | null>(null);
  readonly expandId$ = new BehaviorSubject<string | null>(null);
  readonly viewPictureUrl$ = new BehaviorSubject<string | null>(null);
  readonly flyTo$ = new ReplaySubject<{ lat: number; lng: number }>(1);
  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);

  flyTo(lat: number, lng: number): void {
    this.flyTo$.next({ lat, lng });
  }

  viewPicture(url: string | null): void {
    this.viewPictureUrl$.next(url);
  }

  constructor(private http: HttpClient) {}

  populateFromDb(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.http.get<Asset[]>(environment.API_URL + 'device-reviews').subscribe({
      next: assets => {
        this.assets$.next(assets.map(a => ({
          ...a,
          dateAdded:     a.dateAdded     ? new Date(a.dateAdded)     : null,
          dateSubmitted: a.dateSubmitted ? new Date(a.dateSubmitted) : null,
          modifiedDate:  a.modifiedDate  ? new Date(a.modifiedDate)  : null,
        })));
        this.selectedId$.next(null);
        this.loading$.next(false);
      },
      error: err => {
        console.error('[DeviceReviews] Failed to load:', err);
        this.error$.next(err?.error?.message ?? err?.message ?? `HTTP ${err?.status ?? 'error'}`);
        this.loading$.next(false);
      },
    });
  }

  readonly selected$: Observable<Asset | null> = this.selectedId$.pipe(
    map(id => id ? (this.assets$.value.find(a => a.id === id) ?? null) : null)
  );

  select(id: string | null): void {
    this.selectedId$.next(id);
  }

  expand(id: string): void {
    this.select(id);
    this.expandId$.next(id);
  }

  saveAsset(updated: Asset): void {
    updated.modifiedDate = new Date();
    const assets = this.assets$.value.map(a => a.id === updated.id ? { ...updated } : a);
    this.assets$.next(assets);
  }

  toggleDocReviewed(docId: number): Observable<{ reviewed: boolean }> {
    return this.http.patch<{ reviewed: boolean }>(
      `${environment.API_URL}device-reviews/documents/${docId}/reviewed`,
      {},
    );
  }
}
