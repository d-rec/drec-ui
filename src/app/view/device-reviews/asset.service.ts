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

export interface OpenPicture {
  id: string;
  url: string;
  /** When true, the picture window shows the OCR toolbar instead of Detect Panels. */
  enableOcr: boolean;
  /** Monotonic stacking order — bumped on open and on bringPictureToFront(). */
  zOrder: number;
}

@Injectable()
export class AssetService {
  readonly assets$ = new BehaviorSubject<Asset[]>([]);
  readonly selectedId$ = new BehaviorSubject<string | null>(null);
  readonly expandId$ = new BehaviorSubject<string | null>(null);
  readonly openPictures$ = new BehaviorSubject<OpenPicture[]>([]);
  readonly viewPdfUrl$ = new BehaviorSubject<string | null>(null);
  /** When non-null, the PDF window should show SLD capacity compare for this device. */
  readonly sldDeviceId$ = new BehaviorSubject<number | null>(null);
  /** Doc-token currently hovered in documents-window. The OC# panel
   *  glows every row whose provenance source matches this token —
   *  so when the reviewer mouses over the SLD line, every OC# row
   *  the SLD attested to lights up at once. */
  readonly hoveredDocSource$ = new BehaviorSubject<string | null>(null);
  /** When non-null, the device-info floating window should load & show this device. */
  readonly viewDeviceInfoId$ = new BehaviorSubject<number | null>(null);

  viewDeviceInfo(deviceId: number | null): void {
    this.viewDeviceInfoId$.next(deviceId);
  }
  /** When non-null, the evidence-provenance floating window should
   *  load & show the provenance report for this device. */
  readonly viewProvenanceDeviceId$ = new BehaviorSubject<number | null>(null);

  viewProvenance(deviceId: number | null): void {
    this.viewProvenanceDeviceId$.next(deviceId);
  }
  readonly flyTo$ = new ReplaySubject<{ lat: number; lng: number }>(1);
  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);
  /** Emits only when fresh data is loaded from the server (not on local saves). */
  readonly dataLoaded$ = new Subject<Asset[]>();

  flyTo(lat: number, lng: number): void {
    this.flyTo$.next({ lat, lng });
  }

  /**
   * Shared monotonic counter for every floating window's z-order. Single source
   * so the last-touched window — picture, pdf, info, satellite, anything —
   * always sits on top of every other one regardless of type.
   */
  private zCounter = 500;
  nextZOrder(): number {
    this.zCounter += 1;
    return this.zCounter;
  }

  viewPicture(url: string | null, enableOcr = false): void {
    if (url === null) {
      this.openPictures$.next([]);
      return;
    }
    const current = this.openPictures$.value;
    // If the same URL is already open, bring that picture to the front rather than duplicating.
    const existing = current.find((p) => p.url === url);
    if (existing) {
      this.openPictures$.next(
        current.map((p) =>
          p.id === existing.id ? { ...p, zOrder: this.nextZOrder() } : p,
        ),
      );
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.openPictures$.next([
      ...current,
      { id, url, enableOcr, zOrder: this.nextZOrder() },
    ]);
  }

  /** Promote a specific picture to the top of ALL floating windows. */
  bringPictureToFront(id: string): void {
    const current = this.openPictures$.value;
    const hit = current.find((p) => p.id === id);
    if (!hit) return;
    this.openPictures$.next(
      current.map((p) =>
        p.id === id ? { ...p, zOrder: this.nextZOrder() } : p,
      ),
    );
  }

  closePicture(id: string): void {
    this.openPictures$.next(
      this.openPictures$.value.filter((p) => p.id !== id),
    );
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

  verifyCountryMatch(deviceId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/${deviceId}/country-match`,
    );
  }

  saveVerificationReport(
    deviceId: number,
    elapsedMs: number,
    overallStatus: string | null,
    payload: any,
  ): Observable<{ id: number; uuid: string }> {
    return this.http.post<{ id: number; uuid: string }>(
      `${environment.API_URL}device-reviews/${deviceId}/reports`,
      { elapsedMs, overallStatus, payload },
    );
  }

  getVerificationReport(ref: string | number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_URL}device-reviews/reports/${ref}`,
    );
  }

  detectPanels(imageBase64: string): Observable<any> {
    return this.http
      .post<any>(`${environment.API_URL}device-reviews/detect-panels`, {
        image: imageBase64,
      })
      .pipe(
        retry({ count: 2, delay: (err, attempt) => timer(attempt * 3000) }),
      );
  }

  /** Extract the S3 object key from a presigned URL. */
  extractS3Key(presignedUrl: string): string | null {
    try {
      const url = new URL(presignedUrl);
      // Two URL flavours:
      //   Virtual-hosted (AWS): <bucket>.s3[.<region>].amazonaws.com/<key>
      //     → hostname has ".s3." and ends in "amazonaws.com";
      //       pathname IS the key (just strip leading slash)
      //   Path-style (MinIO localhost, S3 path-style):
      //     <host>/<bucket>/<key>
      //     → pathname is /<bucket>/<key>; strip both
      // We default to PATH-STYLE so any non-AWS endpoint (MinIO,
      // localstack, custom S3 gateway) routes correctly. Earlier
      // virtual-hosted detection that just checked "host doesn't
      // start with s3" was too eager — it ate the bucket prefix
      // for localhost too.
      const host = url.hostname;
      const isVirtualHostedAws =
        host.endsWith('.amazonaws.com') && host.includes('.s3.');
      const parts = url.pathname.split('/');
      const startAt = isVirtualHostedAws ? 1 : 2;
      return parts.slice(startAt).join('/') || null;
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
