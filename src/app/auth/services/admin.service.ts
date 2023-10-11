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

  public GetAllOrganization(pagenumber?: number, limit?: number, searchData?: any): Observable<any> {
    let searchUrl = `${this.url}admin/organizations`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(typeof pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    if (searchData != undefined) {
      if (!(typeof searchData.organizationName === undefined || searchData.organizationName === "" || searchData.organizationName === null)) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }
    }
    return this.httpClient.get<any>(searchUrl);
  }
  public GetOrganizationById(orgId: number): Observable<any> {
    return this.httpClient.get<any>(this.url + 'admin/organizations/' + orgId);
  }
  public GetAllUsers(pagenumber?: number, limit?: number, searchData?: any): Observable<any> {
    let searchUrl = `${this.url}admin/users`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(typeof pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    if (searchData != undefined) {
      if (!(typeof searchData.organizationName === undefined || searchData.organizationName === "" || searchData.organizationName === null)) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }
    }
    return this.httpClient.get(searchUrl);
  }
  public GetAllOrgnaizationUsers(organizationsId: number, pagenumber?: number, limit?: number): Observable<any> {

    let searchUrl = `${this.url}admin/organizations/user/${organizationsId}`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(typeof pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    return this.httpClient.get<any>(searchUrl);
  }
  public updateUser(userId: number, data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'admin/users/' + userId, data)
  }
  public removeUser(userId: number): Observable<any> {
    return this.httpClient.delete<any>(this.url + 'admin/user/' + userId)
  }
  GetDeviceAutocomplete(searchInput: StaticRange, orgId: number): Observable<any> {
    let searchUrl = `${this.url}admin/devices/autocomplete?externalId=` + searchInput + `&organizationId=` + orgId;
    return this.httpClient.get(searchUrl);

  }
  public AddIrecDevice(deviceId: any): Observable<any> {
    return this.httpClient.post<any>(this.url + 'admin/add/device-into-Irec/' + deviceId, {});
  }

  public GetAllApiUsers(pagenumber?: number, limit?: number, searchData?: any): Observable<any> {

    let searchUrl = `${this.url}admin/apiusers`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(typeof pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }

    if (searchData != undefined) {
      if (!(typeof searchData.organizationName === undefined || searchData.organizationName === "" || searchData.organizationName === null)) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }
    }

    return this.httpClient.get<any>(searchUrl);
  }
}
