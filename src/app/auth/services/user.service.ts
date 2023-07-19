import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class UserService {
  url: String = environment.API_URL;
  constructor(private httpClient: HttpClient) { }

  public UserConfirmEmail(token: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'user/confirm-email/' + token,{});
  }
}
