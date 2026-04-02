import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MeterReadReviewDevice, MeterReadEntry } from './meter-read-review.model';

@Injectable()
export class MeterReadReviewService {
  readonly devices$ = new BehaviorSubject<MeterReadReviewDevice[]>([]);
  readonly selectedId$ = new BehaviorSubject<number | null>(null);
  readonly expandId$ = new BehaviorSubject<number | null>(null);
  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);
  readonly dataLoaded$ = new Subject<MeterReadReviewDevice[]>();

  readonly selected$: Observable<MeterReadReviewDevice | null> =
    this.selectedId$.pipe(
      map((id) =>
        id !== null
          ? this.devices$.value.find((d) => d.deviceId === id) ?? null
          : null,
      ),
    );

  constructor(private http: HttpClient) {}

  populateFromDb(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.http
      .get<MeterReadReviewDevice[]>(
        environment.API_URL + 'device-reviews/meter-reads',
      )
      .subscribe({
        next: (devices) => {
          const mapped = devices.map((d) => ({ ...d, reads: [] }));
          this.devices$.next(mapped);
          this.dataLoaded$.next(mapped);
          this.selectedId$.next(null);
          this.loading$.next(false);
        },
        error: (err) => {
          console.error('[MeterReadReviews] Failed to load:', err);
          this.error$.next(
            err?.error?.message ??
              err?.message ??
              `HTTP ${err?.status ?? 'error'}`,
          );
          this.loading$.next(false);
        },
      });
  }

  select(id: number | null): void {
    this.selectedId$.next(id);
  }

  expand(id: number): void {
    this.select(id);
    this.expandId$.next(id);
  }

  loadReads(deviceId: number): Observable<MeterReadEntry[]> {
    return this.http
      .get<any>(environment.API_URL + `device-reviews/meter-reads/${deviceId}/reads`)
      .pipe(
        map((data: any[]) =>
          data.map((r) => ({
            id: r.id,
            value: r.value,
            unit: r.unit,
            type: r.type,
            startDate: r.startDate ?? r.start_date,
            endDate: r.endDate ?? r.end_date,
            certified: r.certified,
          })),
        ),
      );
  }

  updateStatus(
    deviceId: number,
    status: string,
    notes?: string,
    reviewer?: string,
  ): Observable<{ status: string }> {
    return this.http.patch<{ status: string }>(
      environment.API_URL + `device-reviews/meter-reads/${deviceId}/status`,
      { status, notes, reviewer },
    );
  }

  // Reuse existing device-reviews verification endpoints
  reviewHistoricalConsistency(deviceId: number): Observable<any> {
    return this.http.get(
      environment.API_URL +
        `device-reviews/${deviceId}/historical-consistency`,
    );
  }

  checkProductionCeiling(deviceId: number): Observable<any> {
    return this.http.get(
      environment.API_URL + `device-reviews/${deviceId}/production-ceiling`,
    );
  }

  crossSourceVerification(deviceId: number): Observable<any> {
    return this.http.get(
      environment.API_URL + `device-reviews/${deviceId}/cross-source`,
    );
  }

  getAuditTrail(deviceId: number): Observable<any> {
    return this.http.get(
      environment.API_URL + `device-reviews/${deviceId}/audit-trail`,
    );
  }
}
