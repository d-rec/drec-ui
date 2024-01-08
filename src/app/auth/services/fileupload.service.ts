import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpEvent,HttpHeaders  } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class FileuploadService {
  private baseUrl = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private http: HttpClient) {}

  upload(file: File): Observable<HttpEvent<any>> {
    const formData: FormData = new FormData();

    formData.append('files', file);

    const req = new HttpRequest('POST', `${this.baseUrl}file`, formData, {
      reportProgress: true,
      responseType: 'json',
    });

    return this.http.request(req);
    

  }
  csvupload(file: File): Observable<HttpEvent<any>>{
  const formData: FormData = new FormData();

  formData.append('files', file);
    return this.http.post<any>(this.baseUrl+'file', formData)

  }
  addbulkDevices(data: any):Observable<any>{
    return this.http.post<any>(this.baseUrl+'buyer-reservation/process-creation-bulk-devices-csv', data)
  }
  getCsvJobList(): Observable<any> {
    let headers = new HttpHeaders(this.headersData);
    return this.http.get(`${this.baseUrl}buyer-reservation/bulk-upload/get-all-csv-jobs-of-organization`,{headers});
  }
  getJobStatus(id:number): Observable<any> {
    let headers = new HttpHeaders(this.headersData);
    return this.http.get(`${this.baseUrl}buyer-reservation/bulk-upload-status/`+id,{headers});
  }
}