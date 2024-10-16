import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo';
@Injectable({
  providedIn: 'root',
})
export class AdminService {
  url: string = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private httpClient: HttpClient) {}

  public GetAllOrganization(
    pagenumber?: number,
    limit?: number,
    searchData?: any,
  ): Observable<any> {
    let searchUrl = `${this.url}admin/organizations`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    if (searchData != undefined) {
      if (
        !(
          searchData.organizationName === undefined ||
          searchData.organizationName === '' ||
          searchData.organizationName === null
        )
      ) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }

      if (
        !(
          searchData.organizationType === undefined ||
          searchData.organizationType === '' ||
          searchData.organizationType === null
        )
      ) {
        searchUrl += `&organizationType=${searchData.organizationType}`;
      }
    }
    return this.httpClient.get<any>(searchUrl);
  }

  public GetOrganizationById(orgId: number): Observable<any> {
    return this.httpClient.get<any>(this.url + 'admin/organizations/' + orgId);
  }
  public GetAllUsers(
    pagenumber?: number,
    limit?: number,
    searchData?: any,
  ): Observable<any> {
    const headers = new HttpHeaders(this.headersData);
    let searchUrl = `${this.url}admin/users`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    if (searchData != undefined) {
      if (
        !(
          searchData.organizationName === undefined ||
          searchData.organizationName === '' ||
          searchData.organizationName === null
        )
      ) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }
    }
    return this.httpClient.get(searchUrl, { headers });
  }
  public GetAllOrgnaizationUsers(
    organizationsId: number,
    pagenumber?: number,
    limit?: number,
  ): Observable<any> {
    const headers = new HttpHeaders(this.headersData);
    let searchUrl = `${this.url}admin/organizations/user/${organizationsId}`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }
    return this.httpClient.get<any>(searchUrl, { headers });
  }
  public updateUser(userId: number, data: any): Observable<any> {
    return this.httpClient.put<any>(this.url + 'admin/users/' + userId, data);
  }
  public removeUser(userId: number): Observable<any> {
    return this.httpClient.delete<any>(this.url + 'admin/user/' + userId);
  }
  GetDeviceAutocomplete(
    searchInput: StaticRange,
    orgId: number,
  ): Observable<any> {
    const searchUrl =
      `${this.url}admin/devices/autocomplete?externalId=` +
      searchInput +
      `&organizationId=` +
      orgId;
    return this.httpClient.get(searchUrl);
  }
  public AddIrecDevice(deviceId: any): Observable<any> {
    return this.httpClient.post<any>(
      this.url + 'admin/add/device-into-Irec/' + deviceId,
      {},
    );
  }

  public GetAllApiUsers(
    pagenumber?: number,
    limit?: number,
    searchData?: any,
  ): Observable<any> {
    let searchUrl = `${this.url}admin/apiusers`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }

    if (searchData != undefined) {
      if (
        !(
          searchData.organizationName === undefined ||
          searchData.organizationName === '' ||
          searchData.organizationName === null
        )
      ) {
        searchUrl += `&organizationName=${searchData.organizationName}`;
      }
    }

    return this.httpClient.get<any>(searchUrl);
  }
}
