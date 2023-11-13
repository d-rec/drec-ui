import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { YieldConfig } from '../../models/yieldvalue.model';

@Injectable({
  providedIn: 'root'
})
export class ACLModulePermisionService {

  constructor(private httpClient: HttpClient) { }

  /*  add ACL Module wise Permission*/
  getAcl_moduleList(): Observable<any> {
    return this.httpClient.get<any>(environment.API_URL + 'access-control-layer-module-service')
  }
  getAcl_moduleInfoById(id: number): Observable<any> {
    return this.httpClient.get<any>(environment.API_URL + 'access-control-layer-module-service/' + id)
  }
  addACL_module(data: any): Observable<any> {
    return this.httpClient.post<any>(environment.API_URL + 'access-control-layer-module-service', data)

  }
  public PatchYieldInfo(id: any, data: any): Observable<any> {
    return this.httpClient.patch<any>(environment.API_URL + 'access-control-layer-module-service/' + id, data)

  }

 /*  add ACL Module wise Permission*/
 getUserAcl_modulePermissionList(): Observable<any> {
  return this.httpClient.get<any>(environment.API_URL + 'permission')
}
  addUserACL_modulePermission(data: any): Observable<any> {
    return this.httpClient.post<any>(environment.API_URL + 'permission/module', data)

  }
}
