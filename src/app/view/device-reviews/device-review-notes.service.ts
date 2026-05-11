import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface DeviceReviewNote {
  id: number;
  deviceId: number;
  /** Form-field key (e.g. 'capacity', 'address'); null = general. */
  fieldName: string | null;
  body: string;
  status: 'open' | 'resolved';
  createdBy: string;
  createdAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

/**
 * Thin client for the per-field reviewer-notes API. Keeps a
 * device-scoped cache via `notes$` so the inline badges and the
 * reviewer thread stay in sync without re-fetching after each edit.
 */
@Injectable({ providedIn: 'root' })
export class DeviceReviewNotesService {
  /** Last-fetched notes, keyed by deviceId. Components subscribe and
   *  re-render when add/resolve/reopen/delete fire. */
  readonly notes$ = new BehaviorSubject<{
    [deviceId: number]: DeviceReviewNote[];
  }>({});

  constructor(private http: HttpClient) {}

  private url(deviceId: number, suffix = ''): string {
    return `${environment.API_URL}device/${deviceId}/review-notes${suffix}`;
  }

  list(deviceId: number, openOnly = false): Observable<DeviceReviewNote[]> {
    const params = openOnly ? '?openOnly=true' : '';
    return this.http.get<DeviceReviewNote[]>(this.url(deviceId) + params).pipe(
      tap((rows) => this.merge(deviceId, rows)),
    );
  }

  create(
    deviceId: number,
    fieldName: string | null,
    body: string,
  ): Observable<DeviceReviewNote> {
    return this.http
      .post<DeviceReviewNote>(this.url(deviceId), { fieldName, body })
      .pipe(tap((note) => this.upsertOne(deviceId, note)));
  }

  resolve(deviceId: number, noteId: number): Observable<DeviceReviewNote> {
    return this.http
      .patch<DeviceReviewNote>(this.url(deviceId, `/${noteId}/resolve`), {})
      .pipe(tap((note) => this.upsertOne(deviceId, note)));
  }

  reopen(deviceId: number, noteId: number): Observable<DeviceReviewNote> {
    return this.http
      .patch<DeviceReviewNote>(this.url(deviceId, `/${noteId}/reopen`), {})
      .pipe(tap((note) => this.upsertOne(deviceId, note)));
  }

  delete(deviceId: number, noteId: number): Observable<{ ok: true }> {
    return this.http
      .delete<{ ok: true }>(this.url(deviceId, `/${noteId}`))
      .pipe(
        tap(() => {
          const cur = { ...this.notes$.value };
          cur[deviceId] = (cur[deviceId] ?? []).filter((n) => n.id !== noteId);
          this.notes$.next(cur);
        }),
      );
  }

  /** Synchronously read the cached notes for a device. */
  notesFor(deviceId: number): DeviceReviewNote[] {
    return this.notes$.value[deviceId] ?? [];
  }

  openNotesByField(deviceId: number): { [field: string]: DeviceReviewNote[] } {
    const out: { [field: string]: DeviceReviewNote[] } = {};
    for (const n of this.notesFor(deviceId)) {
      if (n.status !== 'open') continue;
      const key = n.fieldName ?? '__general__';
      if (!out[key]) out[key] = [];
      out[key].push(n);
    }
    return out;
  }

  private merge(deviceId: number, rows: DeviceReviewNote[]): void {
    const cur = { ...this.notes$.value };
    cur[deviceId] = rows;
    this.notes$.next(cur);
  }

  private upsertOne(deviceId: number, note: DeviceReviewNote): void {
    const cur = { ...this.notes$.value };
    const list = (cur[deviceId] ?? []).filter((n) => n.id !== note.id);
    cur[deviceId] = [note, ...list].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    this.notes$.next(cur);
  }
}
