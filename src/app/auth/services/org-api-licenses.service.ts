import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface LicenseSettings {
  roboflowApiKey: string | null;
  roboflowWorkflowUrl: string | null;
  deeplApiKey: string | null;
  roboflowCreditsRemaining: number;
  deeplCreditsRemaining: number;
}

export interface CreditInfo {
  roboflow: { credits: number; hasOwnKey: boolean };
  deepl: { credits: number; hasOwnKey: boolean };
}

@Injectable({
  providedIn: 'root',
})
export class OrgApiLicensesService {
  private url = environment.API_URL;

  constructor(private httpClient: HttpClient) {}

  getSettings(): Observable<LicenseSettings> {
    return this.httpClient.get<LicenseSettings>(this.url + 'org-api-licenses');
  }

  saveSettings(data: {
    roboflowApiKey?: string;
    roboflowWorkflowUrl?: string;
    deeplApiKey?: string;
  }): Observable<any> {
    return this.httpClient.post<any>(this.url + 'org-api-licenses', data);
  }

  getCredits(): Observable<CreditInfo> {
    return this.httpClient.get<CreditInfo>(
      this.url + 'org-api-licenses/credits',
    );
  }
}
