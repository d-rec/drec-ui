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
  public verifyOtp(phoneNumber: string, otp: string): Observable<any> {
    return this.httpClient.post<any>(this.url + 'otp/verify-otp', {
      phoneNumber,
      otp,
    });
  }
  public sendOtp(phoneNumber: string): Observable<any> {
    return this.httpClient.post<any>(this.url + 'otp/send-otp', {
      phoneNumber,
    });
  }
}
