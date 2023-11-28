import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
    providedIn: 'root'
})
export class InvitationService {
    url: String = environment.API_URL;
    headersData = getapiuser_header();
    constructor(private httpClient: HttpClient) { }

    public Postuserinvitation( data: any,organizationId?: number): Observable<any> {
        let headers = new HttpHeaders(this.headersData);
        let addUrl = `${this.url}invitation`;
        if (organizationId != null || organizationId != undefined) {
            addUrl += `?organizationId=${organizationId}`;
        }
        return this.httpClient.post<any>(addUrl, data,{headers})

    }
    public getinvitaion():Observable<any>{
        return this.httpClient.get<any>(this.url+'invitation')
    }
    public acceptinvitaion(invitationId:number,data:any):Observable<any>{
        return this.httpClient.put<any>(this.url+'invitation/'+invitationId,data)
    }
}