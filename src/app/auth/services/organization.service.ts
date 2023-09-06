import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrganizationInformation,IPublicOrganization } from '../../models/organization.model';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {

  constructor(private httpClient:HttpClient) { }


  getOrganizationInformation():Observable<OrganizationInformation>
  {
    return this.httpClient.get<OrganizationInformation>(environment.API_URL+'Organization/me')
  }
  changeOrguserRole(orgId:number, userId:number,datarole:any):Observable<any>{
    return this.httpClient.get<OrganizationInformation>(environment.API_URL+'/Organization/'+orgId
    +'/change-role/'+userId,datarole)
  }
  getOrganizationUser():Observable<IPublicOrganization>
  {
    return this.httpClient.get<IPublicOrganization>(environment.API_URL+'Organization/users')
  }
}
