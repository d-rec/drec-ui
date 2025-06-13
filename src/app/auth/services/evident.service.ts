import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class EvidentService {
  url: string = environment.API_URL;
  constructor(private httpClient: HttpClient) {}
  public saveSettings(settings: any): Observable<any> {
    return this.httpClient.post<any>(this.url + 'evident', settings);
  }
  public getSettings(): Observable<any> {
    return this.httpClient.get<any>(this.url + 'evident');
  }
}
