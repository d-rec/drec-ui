import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class OtpService {
  url: string = environment.API_URL;
  constructor(private httpClient: HttpClient) {}
  public verify(code: string): Observable<any> {
    return this.httpClient.post<any>(this.url + 'otp/verify', {
      code,
    });
  }
  public send(): Observable<any> {
    return this.httpClient.post<any>(this.url + 'otp/send', {});
  }
}
