import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { YieldConfig } from '../../models/yieldvalue.model';

@Injectable({
  providedIn: 'root',
})
export class YieldConfigurationService {
  constructor(private httpClient: HttpClient) {}

  getyieldList(): Observable<YieldConfig> {
    return this.httpClient.get<YieldConfig>(
      environment.API_URL + 'yield/config',
    );
  }
  getyieldInfoById(id: number): Observable<YieldConfig> {
    return this.httpClient.get<YieldConfig>(
      environment.API_URL + 'yield/config/' + id,
    );
  }
  addYield(data: any): Observable<YieldConfig> {
    return this.httpClient.post<any>(
      environment.API_URL + 'yield/config',
      data,
    );
  }
  public PatchYieldInfo(id: any, data: any): Observable<any> {
    return this.httpClient.patch<any>(
      environment.API_URL + 'yield/config/update/' + id,
      data,
    );
  }
}
