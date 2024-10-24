import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  url: string = environment.API_URL;
  constructor(private httpClient: HttpClient) {}

  public Postuserinvitation(
    data: any,
    organizationId?: number,
  ): Observable<any> {
    let addUrl = `${this.url}invitation`;
    if (organizationId != null || organizationId != undefined) {
      addUrl += `?organizationId=${organizationId}`;
    }

    return this.httpClient.post<any>(addUrl, data);
  }
  public getinvitaion(): Observable<any> {
    return this.httpClient.get<any>(this.url + 'invitation');
  }
  public getinvitationByemail(): Observable<any> {
    return this.httpClient.get<any>(this.url + 'invitation/By_email');
  }
  public acceptinvitaion(invitationId: number, data: any): Observable<any> {
    return this.httpClient.put<any>(
      this.url + 'invitation/' + invitationId,
      data,
    );
  }
}
