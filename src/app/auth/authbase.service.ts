import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../environments/environment.dev';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AuthbaseService {
  url: String = environment.API_URL;
  constructor(private httpClient: HttpClient) { }

  login(routePath: string, data: any) {

    return this.httpClient.post<any>(this.url + routePath, data)
  }

  ApiUserlogin(routePath: string, client_id: string, client_secret: string, data: any) {
    const headers = new HttpHeaders({

      "client_id": client_id,
      "client_secret": client_secret
    });
    return this.httpClient.post<any>(this.url + routePath, data,{ headers })
  }


  public PostAuth(routePath: string, data: any): Observable<any> {
    return this.httpClient.post<any>(this.url + routePath, data)

  }

  GetMethod(routePath: string) {
    return this.httpClient.get(this.url + routePath)
  }

  logout(routePath: string) {

    return this.httpClient.post<any>(this.url + routePath,{})
  }

  isLoggedIn(): boolean {

    const user = sessionStorage.getItem('access-token');

    if (user) {
      return true;
    }

    return false;
  }
}
