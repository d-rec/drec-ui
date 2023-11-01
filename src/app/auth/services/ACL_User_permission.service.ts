import { HttpClient ,HttpHeaders} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { YieldConfig } from '../../models/yieldvalue.model';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class ACLModulePermisionService {
  headersData = getapiuser_header();
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
  public PatchUserpermission(id: any, data: any): Observable<any> {
    return this.httpClient.patch<any>(environment.API_URL + 'access-control-layer-module-service/' + id, data)

  }

 /*  add ACL Module wise Permission*/
 getUserAcl_modulePermissionList(): Observable<any> {
  return this.httpClient.get<any>(environment.API_URL + 'permission')
}
  addUserACL_modulePermission(data: any): Observable<any> {
    return this.httpClient.post<any>(environment.API_URL + 'permission/module', data)

  }
  public PutUserpermission(id: any, data: any): Observable<any> {
    return this.httpClient.put<any>(environment.API_URL + 'permission/update/' + id, data)

  }

  getUserpermission(data: any): Observable<any> {
    return this.httpClient.get<any>(environment.API_URL + 'permission/user/' + data.user_id)

  }
  getRolepermission(id: any): Observable<any> {
    return this.httpClient.get<any>(environment.API_URL + 'permission/role/' + id)

  }
  ApiUserPermissionRequest(data:any,client_id?: string, client_secret?: string):Observable<any>
{ let headers;
  if (client_id != undefined && client_secret != undefined) {
    headers = new HttpHeaders({

      "client_id": client_id,
      "client_secret": client_secret
    });
  }
  return this.httpClient.post<any>(environment.API_URL + 'permission/module/apiuser/request',data,{ headers })

}
  public updateUserpermissionByAdmin(id: any, data: any): Observable<any> {
    return this.httpClient.put<any>(environment.API_URL + 'permission/module/verify/ByAdmin/' + id, data)

  }

}
