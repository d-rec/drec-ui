import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { getapiuser_header } from '../../utils/apiuser_clientinfo';
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
  ): Observable<any> {
    let searchUrl =
      this.url +
      'certificate-log/issuer/certifiedlogOfdevices?pageNumber=' +
      pagenumber;
    if (searchData != undefined) {
      if (
        !(
          searchData.organizationId === undefined ||
          searchData.organizationId === '' ||
          searchData.organizationId === null ||
          searchData.organizationId === undefined
        )
      ) {
        searchUrl += `&organizationId=${searchData.organizationId}`;
      }
      if (
        !(
          searchData.countryCode === undefined ||
          searchData.countryCode === '' ||
          searchData.countryCode === null
        )
      ) {
        searchUrl += `&country=${searchData.countryCode}`;
      }

      if (
        !(
          searchData.fuelCode === undefined ||
          searchData.fuelCode === '' ||
          searchData.fuelCode === null
        )
      ) {
        searchUrl += `&fuelCode=${searchData.fuelCode}`;
      }

      if (
        !(
          searchData.capacity === undefined ||
          searchData.capacity === '' ||
          searchData.capacity === null
        )
      ) {
        searchUrl += `&capacity=${searchData.capacity}`;
      }
      if (
        !(
          searchData.offTaker === undefined ||
          searchData.offTaker === '' ||
          searchData.offTaker === null
        )
      ) {
        searchUrl += `&offTaker=${searchData.offTaker}`;
      }
      if (
        !(
          searchData.SDGBenefits === undefined ||
          searchData.SDGBenefits === '' ||
          searchData.SDGBenefits === null
        )
      ) {
        searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
      }
      if (
        !(
          typeof searchData.start_date === 'undefined' ||
          searchData.start_date === '' ||
          searchData.start_date === null
        )
      ) {
        searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
      }

      if (
        !(
          typeof searchData.end_date === 'undefined' ||
          searchData.end_date === '' ||
          searchData.end_date === null
        )
      ) {
        searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
      }
      if (
        !(
          typeof searchData.fromAmountread === 'undefined' ||
          searchData.fromAmountread === '' ||
          searchData.fromAmountread === null
        )
      ) {
        searchUrl += `&fromAmountread=${searchData.fromAmountread}`;
      }

      if (
        !(
          typeof searchData.toAmountread === 'undefined' ||
          searchData.toAmountread === '' ||
          searchData.toAmountread === null
        )
      ) {
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
