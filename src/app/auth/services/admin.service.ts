import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AdminService {
  url: String = environment.API_URL;
  constructor(private httpClient: HttpClient) { }

  public GetAllOrganization(): Observable<any> {
    return this.httpClient.get<any>(this.url + 'admin/organizations' );
  }
  public GetAllUsers(): Observable<any> {
    return this.httpClient.get<any>(this.url + 'admin/users' );
  }
  public updateUser(userId:number,data:any):Observable<any>{
    return this.httpClient.put<any>(this.url+'admin/users/'+userId,data)
  }
  public removeUser(userId:number):Observable<any>{
    return this.httpClient.delete<any>(this.url+'admin/user/'+userId)
  }
  public AddIrecDevice(deviceId:any): Observable<any> {
    return this.httpClient.post<any>(this.url + 'admin/add/device-into-Irec/'+deviceId ,{});
  }
}
