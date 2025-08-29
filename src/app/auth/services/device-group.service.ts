import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { isEmpty } from '../../utils/validations';

@Injectable({
  providedIn: 'root',
})
export class DeviceGroupService {
  url: string = environment.API_URL;

  constructor(private httpClient: HttpClient) {}
  GetMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report');
  }

  add(data: any, orgId?: number) {
    let searchUrl = `${this.url}buyer-reservation`;
    if (!(orgId === null || orgId === undefined)) {
      searchUrl += `?orgId=${orgId}`;
    }

    return this.httpClient.post<any>(searchUrl, data);
  }
  addSingleDevicePathway(selectedDevice: any, orgId?: number): Observable<any> {
    let searchUrl = `${this.url}buyer-reservation/pathway`;
    if (orgId) {
      searchUrl += `?orgId=${orgId}`;
    }
    return this.httpClient.post<any>(searchUrl, selectedDevice);
  }
  getReservationData(searchData: any, pagenumber: number): Observable<any> {
    let searchUrl = `${this.url}buyer-reservation/my?pagenumber=` + pagenumber;
    if (!isEmpty(searchData.name)) {
      searchUrl += `&name=${searchData.name}`;
    }
    if (!isEmpty(searchData.deviceIds) && Array.isArray(searchData.deviceIds)) {
      searchData.deviceIds.forEach((id: any) => {
        searchUrl += `&deviceIds=${id}`;
      });
    }
    if (!isEmpty(searchData.countryCode)) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (!isEmpty(searchData.fuelCode)) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;
    }
    if (!isEmpty(searchData.offTaker)) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (!isEmpty(searchData.SDGBenefits)) {
      searchUrl += `&sdgbenefit=${searchData.SDGBenefits}`;
    }

    if (!isEmpty(searchData.reservationStartDate)) {
      searchUrl += `&start_date=${new Date(searchData.reservationStartDate).toISOString()}`;
    }

    if (!isEmpty(searchData.reservationEndDate)) {
      searchUrl += `&end_date=${new Date(searchData.reservationEndDate).toISOString()}`;
    }
    if (!isEmpty(searchData.reservationActive)) {
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

    if (!isEmpty(searchData.organizationId)) {
      searchUrl += `&organizationId=${searchData.organizationId}`;
    }
    if (!isEmpty(searchData.name)) {
      searchUrl += `&name=${searchData.name}`;
    }
    if (!isEmpty(searchData.deviceIds) && Array.isArray(searchData.deviceIds)) {
      searchData.deviceIds.forEach((id: string) => {
        searchUrl += `&deviceIds=${id}`;
      });
    }
    if (!isEmpty(searchData.countryCode)) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (!isEmpty(searchData.fuelCode)) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;
    }
    if (!isEmpty(searchData.offTaker)) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (!isEmpty(searchData.SDGBenefits)) {
      searchUrl += `&sdgbenefit=${searchData.SDGBenefits}`;
    }

    if (!isEmpty(searchData.reservationStartDate)) {
      searchUrl += `&start_date=${new Date(searchData.reservationStartDate).toISOString()}`;
    }

    if (!isEmpty(searchData.reservationEndDate)) {
      searchUrl += `&end_date=${new Date(searchData.reservationEndDate).toISOString()}`;
    }
    if (!isEmpty(searchData.reservationActive)) {
      searchUrl += `&reservationActive=${searchData.reservationActive}`;
    }

    return this.httpClient.get(searchUrl);
  }
}
