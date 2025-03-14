import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BulkUploadType } from '../../../app/utils/enums/bulk-upload-type.enum';
@Injectable({
  providedIn: 'root',
})
export class BulkUploadService {
  private baseUrl = `${environment.API_URL}bulk-upload`;
  private filePath = '../../assets/files/';
  private templates = {
    [BulkUploadType.Reads]: 'd-rec-bulk-upload-meter-read-template.csv',
    [BulkUploadType.Devices]: 'd-rec-device-bulk-upload-template.csv',
  };

  constructor(private http: HttpClient) {}

  bulkUpload({
    file,
    organizationId,
    bulkUploadType,
  }: {
    file: File;
    organizationId?: number;
    bulkUploadType: BulkUploadType;
  }): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const params: any = {
      bulkUploadType,
    };
    if (organizationId) {
      params['organizationId'] = organizationId;
    }
    return this.http.post(`${this.baseUrl}`, formData, {
      params,
    });
  }

  getBulkUploads(bulkUploadType: BulkUploadType): Observable<any> {
    const url = `${this.baseUrl}/?bulkUploadType=${bulkUploadType}`;
    return this.http.get(url);
  }

  getBulkUploadLogs(
    bulkUploadId: number,
    organizationId?: number,
  ): Observable<any> {
    let Url = `${this.baseUrl}/bulk-upload-log/${bulkUploadId}`;
    if (organizationId) {
      Url += `?organizationId=${organizationId}`;
    }
    return this.http.get(Url);
  }
  downloadFile(type: BulkUploadType): Promise<boolean> {
    const filename = this.templates[type];
    if (!filename) throw new Error('Invalid template');
    const anchor = document.createElement('a');
    anchor.href = `${this.filePath}${filename}`;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return Promise.resolve(true);
  }
}
