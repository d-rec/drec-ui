import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class UserService {
  url: String = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private httpClient: HttpClient) { }

  public UserConfirmEmail(token: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/confirm-email/' + token, {});
  }
  public UserForgetPassword(data: any): Observable<any> {
    return this.httpClient.post<any>(this.url + 'user/forget-password', data);
  }
  public UserResetPassword(token: any, data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/reset/password/' + token, data);
  }
  public userProfile(): Observable<any> {
    let headers = new HttpHeaders(this.headersData);
   console.log(headers)
    return this.httpClient.get<any>(this.url + 'user/me', { headers })
  }
  public updatProfile(data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/profile', data)
  }
  public updatPassword(data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/profile', data)
  }
  public resetPassword(token: any, data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/reset/password/' + token, data)
  }
  public getuserById(id: number,client_id?: string, client_secret?: string): Observable<any> {
    let headers;
    if (client_id != undefined && client_secret != undefined) {
      headers = new HttpHeaders({

        "client_id": client_id,
        "client_secret": client_secret
      });
    }
    return this.httpClient.get<any>(this.url + 'user/' + id,{ headers })
  }
}
