import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo';
import { isEmpty } from '../../utils/validate-search-data';
@Injectable({
  providedIn: 'root',
})
export class CertificateService {
  url: string = environment.API_URL;
  headersData = getapiuser_header();
  constructor(private httpClient: HttpClient) {}
  GetRedemptionMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report');
  }
  GetDevoloperCertificateMethod(
    searchData: any,
    pagenumber: number,
    oldlog: boolean,
  ): Observable<any> {
    let searchUrl =
      this.url +
      'certificate-log/issuer/certifiedlogOfdevices?pageNumber=' +
      pagenumber +
      '&oldcertificatelog=' +
      oldlog;
    if (searchData != undefined) {
      if (isEmpty(searchData.organizationId)) {
        searchUrl += `&organizationId=${searchData.organizationId}`;
      }
      if (searchData.deviceIds) {
        searchUrl += `&deviceId=${searchData.deviceIds}`;
      }
      if (isEmpty(searchData.countryCode)) {
        searchUrl += `&country=${searchData.countryCode}`;
      }
      if (isEmpty(searchData.fuelCode)) {
        searchUrl += `&fuelCode=${searchData.fuelCode}`;
      }
      if (isEmpty(searchData.capacity)) {
        searchUrl += `&capacity=${searchData.capacity}`;
      }
      if (isEmpty(searchData.offTaker)) {
        searchUrl += `&offTaker=${searchData.offTaker}`;
      }
      if (isEmpty(searchData.reservationId)) {
        searchUrl += `&reservationId=${searchData.reservationId}`;
      }
      if (isEmpty(searchData.SDGBenefits)) {
        searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
      }
      if (isEmpty(searchData.start_date)) {
        searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
      }
      if (isEmpty(searchData.end_date)) {
        searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
      }
      if (isEmpty(searchData.fromAmountread)) {
        searchUrl += `&fromAmountread=${searchData.fromAmountread}`;
      }
      if (isEmpty(searchData.toAmountread)) {
        searchUrl += `&toAmountread=${searchData.toAmountread}`;
      }
    }

    const headers = new HttpHeaders(this.headersData);

    return this.httpClient.get(searchUrl, { headers });
  }
  getcertifiedlogByGooupUid(
    group_uid: string,
    pagenumber: number,
  ): Observable<any> {
    const searchUrl =
      this.url +
      'certificate-log/issuer/certified/new/' +
      group_uid +
      '?pageNumber=' +
      pagenumber;
    const headers = new HttpHeaders(this.headersData);

    return this.httpClient.get(searchUrl, { headers });
  }

  getcertifiedlogPerDevice(group_uid: string): Observable<any> {
    const searchUrl =
      this.url + 'certificate-log/expoert_perdevice/' + group_uid;

    return this.httpClient.get(searchUrl, { responseType: 'blob' });
  }
}
