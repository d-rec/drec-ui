import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class MeterReadService {
  url: String = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private httpClient: HttpClient) { }
  GetMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report')
  }
  PostRead(exterenalId: string, data: any): Observable<any> {
    let headers: HttpHeaders;
    headers = new HttpHeaders(this.headersData);
    let addUrl = `${this.url}meter-reads/new/` + exterenalId;
   
    return this.httpClient.post<any>(addUrl, data,{headers})

  }
  PostReadByAdmin(exterenalId: string, data: any, orgId?: number): Observable<any> {
    let headers: HttpHeaders;
    headers = new HttpHeaders(this.headersData);
    let addUrl = `${this.url}meter-reads/addByAdmin/new/` + exterenalId;
    if (orgId != undefined) {
      addUrl += `?organizationId=${orgId}`;
    }
    return this.httpClient.post<any>(addUrl, data,{headers})

  }
  GetRead(exterenalId: string, data: any): Observable<any> {
    
    let headers: HttpHeaders;
    headers = new HttpHeaders(this.headersData);
    // return this.httpClient.get<any>(this.url + 'meter-reads/new/'+exterenalId+'? data)
    let searchUrl = `${this.url}meter-reads/new/` + exterenalId + `?readType=meterReads&`;

    if (!(typeof data.start === "undefined" || data.start === "" || data.start === null|| data.start === undefined)) {
      searchUrl += `start=${new Date(data.start).toISOString()}`;
    }

    if (!(typeof data.end === "undefined" || data.end === "" || data.end === null|| data.end === undefined)) {
      searchUrl += `&end=${new Date(data.end).toISOString()}`;

    }

    if (!(typeof data.organizationId === "undefined" || data.organizationId === ""|| data.organizationId === null|| data.organizationId === undefined))
    {
      searchUrl+=`&organizationId=${data.organizationId}`;
    }

    if (!(typeof data.pagenumber === "undefined" || data.pagenumber === "" || data.pagenumber === null)) {
      searchUrl += `&pagenumber=${data.pagenumber}`;
    }

    // if (!(typeof searchData.GroupId === "undefined" || searchData.GroupId === "")) {
    //   searchUrl += `&GroupId=${searchData.GroupId}`;
    // }
    return this.httpClient.get(searchUrl,{headers});
  }
  Getlastread(exterenalId: string): Observable<any> {
    let headers: HttpHeaders;
    headers = new HttpHeaders(this.headersData);
    return this.httpClient.get(this.url + 'meter-reads/latestread/' + exterenalId,{headers})
  }
}
