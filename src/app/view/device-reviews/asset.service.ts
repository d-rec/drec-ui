import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  firstValueFrom,
  map,
  retry,
  timer,
} from 'rxjs';
import { Asset } from './asset.model';
import { environment } from '../../../environments/environment';

@Injectable()
export class AssetService {
  readonly assets$ = new BehaviorSubject<Asset[]>([]);
  readonly selectedId$ = new BehaviorSubject<string | null>(null);
  readonly expandId$ = new BehaviorSubject<string | null>(null);
  readonly viewPictureUrl$ = new BehaviorSubject<string | null>(null);
  readonly viewPictureIsScreenshot$ = new BehaviorSubject<boolean>(false);
  readonly viewPdfUrl$ = new BehaviorSubject<string | null>(null);
  /** When non-null, the PDF window should show SLD capacity compare for this device. */
  readonly sldDeviceId$ = new BehaviorSubject<number | null>(null);
  readonly flyTo$ = new ReplaySubject<{ lat: number; lng: number }>(1);
  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);
  /** Emits only when fresh data is loaded from the server (not on local saves). */
  readonly dataLoaded$ = new Subject<Asset[]>();

  flyTo(lat: number, lng: number): void {
    this.flyTo$.next({ lat, lng });
  }

  viewPicture(url: string | null, isScreenshot = false): void {
    this.viewPictureIsScreenshot$.next(isScreenshot);
    this.viewPictureUrl$.next(url);
  }

  viewPdf(url: string | null): void {
    this.viewPdfUrl$.next(url);
  }

  constructor(private http: HttpClient) {}

  populateFromDb(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.http.get<Asset[]>(environment.API_URL + 'device-reviews').subscribe({
      next: (assets) => {
        const mapped = assets.map((a) => ({
          ...a,
          dateAdded: a.dateAdded ? new Date(a.dateAdded) : null,
          dateSubmitted: a.dateSubmitted ? new Date(a.dateSubmitted) : null,
          modifiedDate: a.modifiedDate ? new Date(a.modifiedDate) : null,
        }));
        this.assets$.next(mapped);
        this.dataLoaded$.next(mapped);
        this.selectedId$.next(null);
        this.loading$.next(false);
      },
      error: (err) => {
        console.error('[DeviceReviews] Failed to load:', err);
        this.error$.next(
          err?.error?.message ??
            err?.message ??
            `HTTP ${err?.status ?? 'error'}`,
        );
        this.loading$.next(false);
      },
    });
  }

  readonly selected$: Observable<Asset | null> = this.selectedId$.pipe(
    map((id) =>
      id ? this.assets$.value.find((a) => a.id === id) ?? null : null,
    ),
  );

  select(id: string | null): void {
    this.selectedId$.next(id);
  }

  expand(id: string): void {
    this.select(id);
    this.expandId$.next(id);
  }

  saveAsset(updated: Asset, persistStatus = false): void {
    const old = this.assets$.value.find((a) => a.id === updated.id);
    updated.modifiedDate = new Date();
    const assets = this.assets$.value.map((a) =>
      a.id === updated.id ? { ...updated } : a,
    );
    this.assets$.next(assets);

    // Persist status change to backend
    if (persistStatus || (old && old.status !== updated.status)) {
      this.updateReviewStatus(
        parseInt(updated.id, 10),
        updated.status,
      ).subscribe({
        error: (err) => console.warn('Failed to persist review status', err),
      });
    }
  }

  updateReviewStatus(
    deviceId: number,
    status: string,
  ): Observable<{ status: string }> {
    return this.http.patch<{ status: string }>(
      `${environment.API_URL}device-reviews/${deviceId}/status`,
      { status },
    );
  }

  deleteDocument(docId: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.API_URL}device-reviews/documents/${docId}`,
    );
  }

  toggleDocReviewed(docId: number): Observable<{ reviewed: boolean }> {
    return this.http.patch<{ reviewed: boolean }>(
      `${environment.API_URL}device-reviews/documents/${docId}/reviewed`,
      {},
    );
  }

  uploadDocument(deviceId: number, type: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return this.http.post<any>(
      `${environment.API_URL}device-reviews/${deviceId}/documents`,
      formData,
    );
  }

  screenForDuplicates(deviceId: number): Observable<{
    duplicates: Array<{
      id: number;
      externalId: string;
      siteName: string;
      serialNumber: string;
      organizationId: number;
      matchType: string;
    }>;
  }> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/duplicates`,
    );
  }

  getAuditTrail(deviceId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.API_URL}device-reviews/${deviceId}/audit-trail`,
    );
  }

  reviewHistoricalConsistency(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/historical-consistency`,
    );
  }

  checkProductionCeiling(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/production-ceiling`,
    );
  }

  classifyPathway(deviceId: number): Observable<any> {
    return this.http.post<any>(
      `${environment.API_URL}device-reviews/${deviceId}/classify-pathway`,
      {},
    );
  }

  crossSourceVerification(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/cross-source`,
    );
  }

  evaluateCompensatingControls(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/compensating-controls`,
    );
  }

  compareSldCapacity(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/sld-compare`,
    );
  }

  setSldCapacity(deviceId: number, sldCapacityKw: number): Observable<any> {
    return this.http.patch<any>(
      `${environment.API_URL}device-reviews/${deviceId}/sld-capacity`,
      { sldCapacityKw },
    );
  }

  autoScreen(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/auto-screen`,
    );
  }

  bulkUpdateStatus(deviceIds: number[], status: string): Observable<any[]> {
    return this.http.patch<any[]>(
      `${environment.API_URL}device-reviews/bulk/status`,
      { deviceIds, status },
    );
  }

  bulkAutoScreen(deviceIds?: number[]): Observable<any[]> {
    return this.http.post<any[]>(
      `${environment.API_URL}device-reviews/bulk/auto-screen`,
      { deviceIds: deviceIds || [] },
    );
  }

  verifyPhotoGps(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/photo-gps`,
    );
  }

  verifySourceAccessMode(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/source-access-verify`,
    );
  }

  detectPanels(imageBase64: string): Observable<any> {
    return this.http.post<any>(
      `${environment.API_URL}device-reviews/detect-panels`,
      { image: imageBase64 },
    ).pipe(
      retry({ count: 2, delay: (err, attempt) => timer(attempt * 3000) }),
    );
  }

  /** Extract the S3 object key from a presigned URL. */
  extractS3Key(presignedUrl: string): string | null {
    try {
      const url = new URL(presignedUrl);
      // Path is like /bucket-name/subfolder/file.jpg — strip leading /bucket/
      const parts = url.pathname.split('/');
      // Remove empty first element and bucket name
      return parts.slice(2).join('/') || null;
    } catch {
      return null;
    }
  }

  /** Request a fresh signed URL from the backend. */
  async refreshUrl(presignedUrl: string): Promise<string> {
    const key = this.extractS3Key(presignedUrl);
    if (!key) return presignedUrl;
    try {
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(
          `${environment.API_URL}device-reviews/refresh-url`,
          { key },
        ),
      );
      return res.url;
    } catch {
      return presignedUrl; // fallback to original
    }
  }

  previewSf02(deviceId: number): Observable<{
    fields: Array<{ label: string; value: string }>;
    documents: Array<{ type: string; present: boolean; required: boolean }>;
  }> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/sf02-preview`,
    );
  }

  generateSf02(deviceId: number): Observable<{ url: string; docId: number }> {
    return this.http.post<{ url: string; docId: number }>(
      `${environment.API_URL}device-reviews/${deviceId}/generate-sf02`,
      {},
    );
  }

  getSatelliteDate(
    lat: number,
    lng: number,
  ): Observable<{ date: string | null; cloudCover: number | null }> {
    return this.http.get<{ date: string | null; cloudCover: number | null }>(
      `${environment.API_URL}device-reviews/satellite-date`,
      { params: { lat: lat.toString(), lng: lng.toString() } },
    );
  }
}
