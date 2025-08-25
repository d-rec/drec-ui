import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../..//environments/environment';
import { Injectable } from '@angular/core';
import { EvidentIssuerResponse, EvidentIssuer } from '../../models/evident';

@Injectable({
  providedIn: 'root',
})
export class IssuerService {
  url: string = environment.API_URL;
  constructor(private http: HttpClient) {}

  createIssuer(issuerData: EvidentIssuer): Observable<EvidentIssuerResponse> {
    return this.http.post<EvidentIssuerResponse>(
      `${this.url}evident/register-issuer`,
      issuerData,
    );
  }

  getIssuers(
    page: number = 1,
    pageSize: number = 10,
  ): Observable<{ data: EvidentIssuerResponse[]; total: number }> {
    return this.http.get<{ data: EvidentIssuerResponse[]; total: number }>(
      `${this.url}evident/issuers?page=${page}&pageSize=${pageSize}`,
    );
  }
}
