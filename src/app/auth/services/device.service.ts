import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
//import {environment} from '../../../environments/environment.dev';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Device } from '../../models/device.model';
import { getapiuser_header } from '../../utils/apiuser_clientinfo'
@Injectable({
  providedIn: 'root'
})
export class DeviceService {

  url: String = environment.API_URL;
   headersData = getapiuser_header();
  // headers:HttpHeaders  = new HttpHeaders(this.headersData);
  constructor(private httpClient: HttpClient) { }
  GetDevicesForAdmin(): Observable<any> {
    return this.httpClient.get(this.url + 'device')
  }
  GetMyDevices(deviceurl: any, searchData?: any, pagenumber?: number): Observable<any> {
    // return this.httpClient.get(this.url + 'device/my')
    console.log(deviceurl);
    console.log(searchData);
    let searchUrl = `${this.url}` + deviceurl;
    console.log(searchUrl);
    if (searchData != undefined) {
      if (!(typeof searchData.pagenumber === undefined || searchData.pagenumber === "" || searchData.pagenumber === null||searchData.pagenumber===undefined)) {
        searchUrl += `pagenumber=${pagenumber}`;
      }
      if (!(typeof searchData.organizationId === undefined || searchData.organizationId === "" || searchData.organizationId === null || searchData.organizationId === undefined)) {
        searchUrl += `&OrganizationId=${searchData.organizationId}`;
      }
      if (!(typeof searchData.countryCode === undefined || searchData.countryCode === "" || searchData.countryCode === null || searchData.countryCode === undefined)) {
        searchUrl += `&country=${searchData.countryCode}`;
      }

      if (!(typeof searchData.fuelCode === undefined || searchData.fuelCode === "" || searchData.fuelCode === null|| searchData.fuelCode === undefined)) {

        searchUrl += `&fuelCode=${searchData.fuelCode}`;

      }

      if (!(typeof searchData.deviceTypeCode === undefined || searchData.deviceTypeCode === "" || searchData.deviceTypeCode === null|| searchData.deviceTypeCode === undefined)) {
        searchUrl += `&deviceTypeCode=${searchData.deviceTypeCode}`;
      }

      if (!(typeof searchData.capacity === undefined || searchData.capacity === "" || searchData.capacity === null|| searchData.capacity === undefined)) {
        searchUrl += `&capacity=${searchData.capacity}`;
      }
      if (!(typeof searchData.offTaker === undefined || searchData.offTaker === "" || searchData.offTaker === null|| searchData.offTaker === undefined)) {
        searchUrl += `&offTaker=${searchData.offTaker}`;
      }
      if (!(typeof searchData.SDGBenefits === undefined || searchData.SDGBenefits === "" || searchData.SDGBenefits === null||searchData.SDGBenefits === undefined)) {
        console.log(typeof searchData.SDGBenefits)
        console.log(searchData.SDGBenefits)
        searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
      }
      if (!(typeof searchData.start_date === "undefined" || searchData.start_date === "" || searchData.start_date === null||searchData.start_date === undefined)) {
        searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
      }

      if (!(typeof searchData.end_date === "undefined" || searchData.end_date === "" || searchData.end_date === null||searchData.start_date === undefined)) {
        searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
      }
    }
    let headers = new HttpHeaders(this.headersData);
    return this.httpClient.get(searchUrl,{headers});

  }
  GetDevicesInfo(id: number): Observable<Device> {
    return this.httpClient.get<Device>(this.url + 'device/' + id)
  }
  GetDevicesInfoByExternalId(ExternalId: any): Observable<Device> {
    return this.httpClient.get<Device>(this.url + 'device/externalId/' + ExternalId)
  }
  getDeviceInfoBYexternalId(externalid: string): Observable<any> {
    return this.httpClient.get(this.url + 'device/externalId/' + externalid)
  }
  public Postdevices(data: any): Observable<any> {
   let headers = new HttpHeaders(this.headersData);
    return this.httpClient.post<any>(this.url + 'device', data,{headers})

  }
  public Patchdevices(id: any, data: any): Observable<any> {
    return this.httpClient.patch<any>(this.url + 'device/' + id, data)

  }

  GetUnreserveDevices(): Observable<any> {
    return this.httpClient.get(this.url + 'device/ungrouped/buyerreservation')
  }
  getfilterData(searchData: any, pagenumber: number): Observable<any> {
    //    return this.http.get(`${environment.BlueNumberGlobalAPI}/api/v1/Organization/search/paged`, { params: params, observe: 'response' });
    let searchUrl = `${this.url}device/ungrouped/buyerreservation?pagenumber=` + pagenumber;

    if (!(typeof searchData.countryCode === "undefined" || searchData.countryCode === "" || searchData.countryCode === null)) {
      searchUrl += `&country=${searchData.countryCode}`;
    }

    if (!(typeof searchData.fuelCode === "undefined" || searchData.fuelCode === "" || searchData.fuelCode === null)) {
      searchUrl += `&fuelCode=${searchData.fuelCode}`;

    }

    if (!(typeof searchData.deviceTypeCode === "undefined" || searchData.deviceTypeCode === "" || searchData.deviceTypeCode === null)) {
      searchUrl += `&deviceTypeCode=${searchData.deviceTypeCode}`;
    }

    if (!(typeof searchData.capacity === "undefined" || searchData.capacity === "" || searchData.capacity === null)) {
      searchUrl += `&capacity=${searchData.capacity}`;
    }
    if (!(typeof searchData.offTaker === "undefined" || searchData.offTaker === "" || searchData.offTaker === null)) {
      searchUrl += `&offTaker=${searchData.offTaker}`;
    }
    if (!(typeof searchData.SDGBenefits === undefined || searchData.SDGBenefits === "" || searchData.SDGBenefits === null)) {
      console.log(typeof searchData.SDGBenefits)
      console.log(searchData.SDGBenefits)
      searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
    }
    if (!(typeof searchData.start_date === "undefined" || searchData.start_date === "" || searchData.start_date === null)) {
      searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
    }

    if (!(typeof searchData.end_date === "undefined" || searchData.end_date === "" || searchData.end_date === null)) {
      searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
    }
    return this.httpClient.get(searchUrl);
  }
  getcertifieddevicelogdate(externalId: any, groupId: any): Observable<any> {
    return this.httpClient.get(this.url + 'device/certifiedlog/first&lastdate?externalId=' + externalId + '&groupUid=' + groupId)
  }
  GetDeviceAutocomplete(searchInput: StaticRange): Observable<any> {
    let searchUrl = `${this.url}device/my/autocomplete?externalId=` + searchInput;
    return this.httpClient.get(searchUrl);

  }
  RemoveDevice(id: number): Observable<any> {
    let searchUrl = `${this.url}device/` + id;
    return this.httpClient.delete(searchUrl);
  }
  addByAdminbulkDevices(organizationId:number,data: any):Observable<any>{
    
    return this.httpClient.post<any>(this.url+'device/addByAdmin/process-creation-bulk-devices-csv/'+organizationId, data)
  }
}
