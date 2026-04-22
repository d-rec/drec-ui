import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Webhook {
  id: number;
  userId: number;
  organizationId: number | null;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly apiUrl = `${environment.API_URL}chat/webhooks`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Webhook[]> {
    return this.http.get<Webhook[]>(this.apiUrl);
  }

  getOne(id: number): Observable<Webhook> {
    return this.http.get<Webhook>(`${this.apiUrl}/${id}`);
  }

  create(data: {
    url: string;
    events: string[];
    secret?: string;
  }): Observable<Webhook> {
    return this.http.post<Webhook>(this.apiUrl, data);
  }

  update(
    id: number,
    data: Partial<{
      url: string;
      events: string[];
      secret: string;
      active: boolean;
    }>,
  ): Observable<Webhook> {
    return this.http.patch<Webhook>(`${this.apiUrl}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  test(id: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/${id}/test`,
      {},
    );
  }
}
