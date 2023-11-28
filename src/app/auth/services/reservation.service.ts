import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  url: String = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private httpClient: HttpClient) { }
  GetMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report')
  }
  // requestAllOrganizationsBluenumberInfoWithJobId(jobId: string): Observable<any> {
  //   return this.http.get(`${environment.BlueNumberGlobalAPI}/api/v1/Organization/Job/${jobId}`);
  // }
  AddReservation(data: any, orgId?: number) {

    let searchUrl = `${this.url}buyer-reservation`
    if (!(orgId === null || orgId === undefined)) {
      searchUrl += `?orgId=${orgId}`;
    }
    let headers = new HttpHeaders(this.headersData);
    return this.httpClient.post<any>(searchUrl, data, { headers })
  }
  getReservationData(searchData: any, pagenumber: number): Observable<any> {
    //    return this.http.get(`${environment.BlueNumberGlobalAPI}/api/v1/Organization/search/paged`, { params: params, observe: 'response' });
    let searchUrl = `${this.url}buyer-reservation/my?pagenumber=` + pagenumber;

    if (!(typeof searchData.countryCode === "undefined" || searchData.countryCode === "" || searchData.countryCode === null)) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (!(typeof searchData.fuelCode === "undefined" || searchData.fuelCode === "" || searchData.fuelCode === null)) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;

    }
    if (!(typeof searchData.offTaker === "undefined" || searchData.offTaker === "" || searchData.offTaker === null)) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (!(typeof searchData.SDGBenefits === "undefined" || searchData.SDGBenefits === "" || searchData.SDGBenefits === null)) {
      searchUrl += `&sdgbenefit=${searchData.SDGBenefits}`;
    }

    if (!(typeof searchData.reservationStartDate === "undefined" || searchData.reservationStartDate === "" || searchData.reservationStartDate === null)) {
      searchUrl += `&start_date=${new Date(searchData.reservationStartDate).toISOString()}`;
    }

    if (!(typeof searchData.reservationEndDate === "undefined" || searchData.reservationEndDate === "" || searchData.reservationEndDate === null)) {
      searchUrl += `&end_date=${new Date(searchData.reservationEndDate).toISOString()}`;
    }
    if (!(typeof searchData.reservationActive === "undefined" || searchData.reservationActive === "" || searchData.reservationActive === null)) {
      searchUrl += `&reservationActive=${searchData.reservationActive}`;
    }
    // if (!(typeof searchData.GroupId === "undefined" || searchData.GroupId === "")) {
    //   searchUrl += `&GroupId=${searchData.GroupId}`;
    // }
    return this.httpClient.get(searchUrl);
  }
  GetnextissuanceCycleinfo(group_uid: any): Observable<any> {
    return this.httpClient.get(this.url + 'buyer-reservation/current-information/' + group_uid)
  }
  GetMethodById(groupId: any): Observable<any> {
    return this.httpClient.get(this.url + 'buyer-reservation/' + groupId)
  }
  public PostAuth(routePath: string, data: any): Observable<any> {
    return this.httpClient.post<any>(this.url + routePath, data)

  }
}
