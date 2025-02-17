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
  private readsDownloadedFileName = 'd-rec-bulk-upload-meter-read-template.csv';
  private devicesDownloadedFileName = 'd-rec-device-bulk-upload-template.csv';

  constructor(private http: HttpClient) {}

  bulkUpload(
    file: File,
    organizationId: number,
    bulkUploadType: BulkUploadType,
  ): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(
      `${this.baseUrl}/?organizationId=${organizationId}&bulkUploadType=${bulkUploadType}`,
      formData,
    );
  }

  getBulkUploads(
    bulkUploadType: BulkUploadType,
    organizationId?: number,
  ): Observable<any> {
    let url = `${this.baseUrl}/?bulkUploadType=${bulkUploadType}`;

    if (organizationId) {
      url += `&organizationId=${organizationId}`;
    }

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
  downloadFile(type: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const anchor = document.createElement('a');
        if (type === BulkUploadType.Reads) {
          anchor.href = `${this.filePath}${this.readsDownloadedFileName}`;
          anchor.download = this.readsDownloadedFileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } else {
          anchor.href = `${this.filePath}${this.devicesDownloadedFileName}`;
          anchor.download = this.devicesDownloadedFileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }
}
