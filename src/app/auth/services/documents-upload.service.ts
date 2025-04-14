import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DocumentsUploadService {
  url: string = environment.API_URL;
  constructor(private httpClient: HttpClient) {}

  uploadDocument(
    targetId: number,
    targetType: string,
    documentType: string,
    file: File,
  ): Observable<any> {
    console.log(targetId, targetType, documentType, file);
    const params: any = {
      targetType,
      documentType,
    };
    const searchUrl = `${this.url}document-uploads/${targetId}`;
    const formData = new FormData();
    formData.append('document', file);
    return this.httpClient.post(searchUrl, formData, { params });
  }
}
