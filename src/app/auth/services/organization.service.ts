import { HttpClient ,HttpHeaders} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrganizationInformation,IPublicOrganization } from '../../models/organization.model';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  headersData = getapiuser_header();
  constructor(private httpClient:HttpClient) { }


  getOrganizationInformation():Observable<OrganizationInformation>
  {
    return this.httpClient.get<OrganizationInformation>(environment.API_URL+'Organization/me')
  }
  changeOrguserRole(orgId:number, userId:number,datarole:any):Observable<any>{
    return this.httpClient.get<OrganizationInformation>(environment.API_URL+'/Organization/'+orgId
    +'/change-role/'+userId,datarole)
  }
  getOrganizationUser(pagenumber?:number,limit?:number):Observable<IPublicOrganization>
  {
    let searchUrl = `${environment.API_URL}Organization/users`;
    if (pagenumber != undefined && limit != undefined ) {
      if (!(typeof pagenumber === undefined || pagenumber === null)) {
        searchUrl += `?pageNumber=${pagenumber}&limit=${limit}` ;
      }
    }
    return this.httpClient.get<IPublicOrganization>(searchUrl)
  }
  public GetOrganizationById(orgId: number): Observable<any> {
     //@ts-ignore
    let headers = new HttpHeaders(this.headersData);
    return this.httpClient.get<any>(environment.API_URL+ 'Organization/' + orgId,{headers});
  }
  public GetApiUserAllOrganization(pagenumber?: number, limit?: number, searchData?: any): Observable<any> {
    //@ts-ignore
    let headers = new HttpHeaders(this.headersData);
    let searchUrl = `${environment.API_URL}Organization/apiuser/all_organization`;
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
    return this.httpClient.get<any>(searchUrl,{headers});
  }
}
