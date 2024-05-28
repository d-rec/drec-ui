import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Device } from '../../models/device.model';
@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  url: string = environment.API_URL;

  constructor(private httpClient: HttpClient) {}
  GetDevicesForAdmin(): Observable<any> {
    return this.httpClient.get(this.url + 'device');
  }
  GetMyDevices(
    deviceurl: any,
    searchData?: any,
    pagenumber?: number,
  ): Observable<any> {
    let searchUrl = `${this.url}` + deviceurl;
    if (!(pagenumber === null || pagenumber === undefined)) {
      searchUrl += `pagenumber=${pagenumber}`;
    }

    if (searchData != undefined) {
      if (
        !(
          searchData.organizationId === '' ||
          searchData.organizationId === null ||
          searchData.organizationId === undefined
        )
      ) {
        searchUrl += `&organizationId=${searchData.organizationId}`;
      }
      if (
        !(
          searchData.countryCode === '' ||
          searchData.countryCode === null ||
          searchData.countryCode === undefined
        )
      ) {
        searchUrl += `&country=${searchData.countryCode}`;
      }
      if (
        !(
          searchData.fuelCode === '' ||
          searchData.fuelCode === null ||
          searchData.fuelCode === undefined
        )
      ) {
        searchUrl += `&fuelCode=${searchData.fuelCode}`;
      }
      if (
        !(
          searchData.deviceTypeCode === '' ||
          searchData.deviceTypeCode === null ||
          searchData.deviceTypeCode === undefined
        )
      ) {
        searchUrl += `&deviceTypeCode=${searchData.deviceTypeCode}`;
      }
      if (
        !(
          searchData.capacity === '' ||
          searchData.capacity === null ||
          searchData.capacity === undefined
        )
      ) {
        searchUrl += `&capacity=${searchData.capacity}`;
      }
      if (
        !(
          searchData.offTaker === '' ||
          searchData.offTaker === null ||
          searchData.offTaker === undefined
        )
      ) {
        searchUrl += `&offTaker=${searchData.offTaker}`;
      }
      if (
        !(
          searchData.SDGBenefits === '' ||
          searchData.SDGBenefits === null ||
          searchData.SDGBenefits === undefined
        )
      ) {
        searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
      }
      if (
        !(
          typeof searchData.start_date === 'undefined' ||
          searchData.start_date === '' ||
          searchData.start_date === null ||
          searchData.start_date === undefined
        )
      ) {
        searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
      }

      if (
        !(
          typeof searchData.end_date === 'undefined' ||
          searchData.end_date === '' ||
          searchData.end_date === null ||
          searchData.start_date === undefined
        )
      ) {
        searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
      }
    }

    return this.httpClient.get(searchUrl);
  }
  GetDevicesInfo(id: number): Observable<Device> {
    return this.httpClient.get<Device>(this.url + 'device/' + id);
  }

  getDeviceInfoBYexternalId(externalid: string): Observable<any> {
    return this.httpClient.get(this.url + 'device/externalId/' + externalid);
  }
  public Postdevices(data: any): Observable<any> {
    return this.httpClient.post<any>(this.url + 'device', data);
  }
  public Patchdevices(id: any, data: any): Observable<any> {
    return this.httpClient.patch<any>(this.url + 'device/' + id, data);
  }

  GetUnreserveDevices(): Observable<any> {
    return this.httpClient.get(this.url + 'device/ungrouped/buyerreservation');
  }
  getfilterData(searchData: any, pagenumber: number): Observable<any> {
    let searchUrl =
      `${this.url}device/ungrouped/buyerreservation?pagenumber=` + pagenumber;

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
        typeof searchData.deviceTypeCode === 'undefined' ||
        searchData.deviceTypeCode === '' ||
        searchData.deviceTypeCode === null
      )
    ) {
      searchUrl += `&deviceTypeCode=${searchData.deviceTypeCode}`;
    }

    if (
      !(
        typeof searchData.capacity === 'undefined' ||
        searchData.capacity === '' ||
        searchData.capacity === null
      )
    ) {
      searchUrl += `&capacity=${searchData.capacity}`;
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

    return this.httpClient.get(searchUrl);
  }
  getcertifieddevicelogdate(groupId: any, pagenumber?: any): Observable<any> {
    let searchUrl =
      `${this.url}device/certifiedlog/first&lastdate?groupUid=` + groupId;

    if (
      !(
        typeof pagenumber === 'undefined' ||
        pagenumber === '' ||
        pagenumber === null
      )
    ) {
      searchUrl += `&pagenumber=${pagenumber}`;
    }

    return this.httpClient.get(searchUrl);
  }
  GetDeviceAutocomplete(searchInput: StaticRange): Observable<any> {
    const searchUrl =
      `${this.url}device/my/autocomplete?externalId=` + searchInput;
    return this.httpClient.get(searchUrl);
  }
  RemoveDevice(id: number): Observable<any> {
    const searchUrl = `${this.url}device/` + id;

    return this.httpClient.delete(searchUrl);
  }
  addByAdminbulkDevices(organizationId: number, data: any): Observable<any> {
    return this.httpClient.post<any>(
      this.url +
        'device/addByAdmin/process-creation-bulk-devices-csv/' +
        organizationId,
      data,
    );
  }
}
