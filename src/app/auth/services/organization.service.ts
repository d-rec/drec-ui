import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrganizationInformation,
  IPublicOrganization,
} from '../../models/organization.model';
@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  constructor(private httpClient: HttpClient) {}

  getOrganizationInformation(): Observable<OrganizationInformation> {
    return this.httpClient.get<OrganizationInformation>(
      environment.API_URL + 'Organization/me',
    );
  }
  changeOrguserRole(
    orgId: number,
    userId: number,
    datarole: any,
  ): Observable<any> {
    return this.httpClient.get<OrganizationInformation>(
      environment.API_URL + '/Organization/' + orgId + '/change-role/' + userId,
      datarole,
    );
  }
  getOrganizationUser(
    pagenumber?: number,
    limit?: number,
  ): Observable<IPublicOrganization> {
    let searchUrl = `${environment.API_URL}Organization/users`;
    if (pagenumber != undefined && limit != undefined) {
      if (!(pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}`;
      }
    }

    return this.httpClient.get<IPublicOrganization>(searchUrl);
  }
  public GetOrganizationById(orgId: number): Observable<any> {
    return this.httpClient.get<any>(
      environment.API_URL + 'Organization/' + orgId,
    );
  }
  public GetApiUserAllOrganization(
    pagenumber?: number,
    limit?: number,
    searchData?: any,
  ): Observable<{ organizations: OrganizationInformation[] }> {
    let searchUrl = `${environment.API_URL}Organization/apiuser/all_organization`;
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
    return this.httpClient.get<{ organizations: OrganizationInformation[] }>(
      searchUrl,
    );
  }
  public removeUser(userId: number): Observable<any> {
    return this.httpClient.delete<any>(
      environment.API_URL + 'Organization/user/' + userId,
    );
  }
}
