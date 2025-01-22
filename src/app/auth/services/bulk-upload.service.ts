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
  private filePath =
    '../../assets/files/d-rec_bulk_upload_meter_read_template.csv';
  private downloadedFileName = 'd-rec_bulk_upload_meter_read_template.csv';

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

  getBulkUploads(organizationId?: number): Observable<any> {
    if (organizationId) {
      return this.http.get(`${this.baseUrl}/?organizationId=${organizationId}`);
    }
    return this.http.get(this.baseUrl);
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
  downloadFile(): void {
    try {
      const anchor = document.createElement('a');
      anchor.href = this.filePath;
      anchor.download = this.downloadedFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      throw new Error('Error downloading file:');
    }
  }
}
