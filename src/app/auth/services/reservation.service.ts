import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  url: string = environment.API_URL;

  constructor(private httpClient: HttpClient) {}
  GetMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report');
  }

  AddReservation(data: any, orgId?: number) {
    let searchUrl = `${this.url}buyer-reservation`;
    if (!(orgId === null || orgId === undefined)) {
      searchUrl += `?orgId=${orgId}`;
    }

    return this.httpClient.post<any>(searchUrl, data);
  }
  getReservationData(searchData: any, pagenumber: number): Observable<any> {
    let searchUrl = `${this.url}buyer-reservation/my?pagenumber=` + pagenumber;
    if (
      !(
        typeof searchData.name === 'undefined' ||
        searchData.name === '' ||
        searchData.name === null
      )
    ) {
      searchUrl += `&name=${searchData.name}`;
    }
    if (
      !(
        typeof searchData.countryCode === 'undefined' ||
        searchData.countryCode === '' ||
        searchData.countryCode === null
      )
    ) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (
      !(
        typeof searchData.fuelCode === 'undefined' ||
        searchData.fuelCode === '' ||
        searchData.fuelCode === null
      )
    ) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;
    }
    if (
      !(
        typeof searchData.offTaker === 'undefined' ||
        searchData.offTaker === '' ||
        searchData.offTaker === null
      )
    ) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (
      !(
        typeof searchData.SDGBenefits === 'undefined' ||
        searchData.SDGBenefits === '' ||
        searchData.SDGBenefits === null
      )
    ) {
      searchUrl += `&sdgbenefit=${searchData.SDGBenefits}`;
    }

    if (
      !(
        typeof searchData.reservationStartDate === 'undefined' ||
        searchData.reservationStartDate === '' ||
        searchData.reservationStartDate === null
      )
    ) {
      searchUrl += `&start_date=${new Date(searchData.reservationStartDate).toISOString()}`;
    }

    if (
      !(
        typeof searchData.reservationEndDate === 'undefined' ||
        searchData.reservationEndDate === '' ||
        searchData.reservationEndDate === null
      )
    ) {
      searchUrl += `&end_date=${new Date(searchData.reservationEndDate).toISOString()}`;
    }
    if (
      !(
        typeof searchData.reservationActive === 'undefined' ||
        searchData.reservationActive === '' ||
        searchData.reservationActive === null
      )
    ) {
      searchUrl += `&reservationActive=${searchData.reservationActive}`;
    }

    return this.httpClient.get(searchUrl);
  }
  GetnextissuanceCycleinfo(
    group_uid: any,
    pagenumber?: number,
  ): Observable<any> {
    return this.httpClient.get(
      this.url +
        'buyer-reservation/current-information/' +
        group_uid +
        '?pagenumber=' +
        pagenumber,
    );
  }
  GetMethodById(groupId: any): Observable<any> {
    return this.httpClient.get(this.url + 'buyer-reservation/' + groupId);
  }
  public PostAuth(routePath: string, data: any): Observable<any> {
    return this.httpClient.post<any>(this.url + routePath, data);
  }
  getReservationDataByadmin(
    searchData: any,
    pagenumber: number,
  ): Observable<any> {
    let searchUrl = `${this.url}buyer-reservation?pagenumber=` + pagenumber;

    if (
      !(
        typeof searchData.organizationId === 'undefined' ||
        searchData.organizationId === '' ||
        searchData.organizationId === null
      )
    ) {
      searchUrl += `&organizationId=${searchData.organizationId}`;
    }
    if (
      !(
        typeof searchData.name === 'undefined' ||
        searchData.name === '' ||
        searchData.name === null
      )
    ) {
      searchUrl += `&name=${searchData.name}`;
    }
    if (
      !(
        typeof searchData.countryCode === 'undefined' ||
        searchData.countryCode === '' ||
        searchData.countryCode === null
      )
    ) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (
      !(
        typeof searchData.fuelCode === 'undefined' ||
        searchData.fuelCode === '' ||
        searchData.fuelCode === null
      )
    ) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;
    }
    if (
      !(
        typeof searchData.offTaker === 'undefined' ||
        searchData.offTaker === '' ||
        searchData.offTaker === null
      )
    ) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (
      !(
        typeof searchData.SDGBenefits === 'undefined' ||
        searchData.SDGBenefits === '' ||
        searchData.SDGBenefits === null
      )
    ) {
      searchUrl += `&sdgbenefit=${searchData.SDGBenefits}`;
    }

    if (
      !(
        typeof searchData.reservationStartDate === 'undefined' ||
        searchData.reservationStartDate === '' ||
        searchData.reservationStartDate === null
      )
    ) {
      searchUrl += `&start_date=${new Date(searchData.reservationStartDate).toISOString()}`;
    }

    if (
      !(
        typeof searchData.reservationEndDate === 'undefined' ||
        searchData.reservationEndDate === '' ||
        searchData.reservationEndDate === null
      )
    ) {
      searchUrl += `&end_date=${new Date(searchData.reservationEndDate).toISOString()}`;
    }
    if (
      !(
        typeof searchData.reservationActive === 'undefined' ||
        searchData.reservationActive === '' ||
        searchData.reservationActive === null
      )
    ) {
      searchUrl += `&reservationActive=${searchData.reservationActive}`;
    }

    return this.httpClient.get(searchUrl);
  }
}
