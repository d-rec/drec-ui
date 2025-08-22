import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../..//environments/environment';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class IssuerService {
  url: string = environment.API_URL;
  constructor(private http: HttpClient) {}

  createIssuer(issuerData: any): Observable<any> {
    return this.http.post(`${this.url}evident/register-issuer`, issuerData);
  }
}
