import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CaptureStatus = 'Pending' | 'Approved' | 'Rejected';

export interface FieldCapture {
  id: number;
  uuid: string;
  clientCaptureId: string;
  organizationId: number;
  submittedByEmail: string;
  status: CaptureStatus;
  serialNumber: string;
  serialRaw: string | null;
  serialSource: 'barcode' | 'ocr' | 'ocr-corrected' | 'manual';
  ocrConfidence: number | null;
  latitude: string;
  longitude: string;
  gpsAccuracyM: number | null;
  photoKey: string;
  payload: Record<string, any>;
  matchedDeviceId: number | null;
  deviceId: number | null;
  reviewNote: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export type FieldCaptureDetail = FieldCapture & { photoUrl: string };

@Injectable()
export class FieldCaptureReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.API_URL}field-capture`;

  public queue(status: CaptureStatus): Observable<FieldCapture[]> {
    return this.http.get<FieldCapture[]>(this.base, {
      params: { status },
      headers: this.headers(),
    });
  }

  public detail(uuid: string): Observable<FieldCaptureDetail> {
    return this.http.get<FieldCaptureDetail>(`${this.base}/${uuid}`, {
      headers: this.headers(),
    });
  }

  public approve(
    uuid: string,
    body: {
      serialNumber?: string;
      payload?: Record<string, any>;
      reviewNote?: string;
    },
  ): Observable<FieldCapture> {
    return this.http.post<FieldCapture>(`${this.base}/${uuid}/approve`, body, {
      headers: this.headers(),
    });
  }

  public reject(uuid: string, reviewNote: string): Observable<FieldCapture> {
    return this.http.post<FieldCapture>(
      `${this.base}/${uuid}/reject`,
      { reviewNote },
      { headers: this.headers() },
    );
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${sessionStorage.getItem('access-token') ?? ''}`,
    };
  }
}
