import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
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
  getDocuments(deviceId: number): Observable<
    {
      type: string;
      url: string;
      id: number;
      label: string | null;
      originalFilename: string | null;
      createdAt: string;
      extractions?: Record<string, any>;
    }[]
  > {
    return this.httpClient.get<
      {
        type: string;
        url: string;
        id: number;
        label: string | null;
        originalFilename: string | null;
        createdAt: string;
        extractions?: Record<string, any>;
      }[]
    >(this.url + 'device/' + deviceId + '/documents');
  }

  saveDocumentExtraction(
    documentId: number,
    endpoint: string,
    response: Record<string, any>,
  ): Observable<{ ok: true }> {
    return this.httpClient.put<{ ok: true }>(
      `${this.url}document-uploads/${documentId}/extractions/${endpoint}`,
      response,
    );
  }

  uploadSingleDocument(
    deviceId: number,
    type: string,
    file: File,
  ): Observable<{ id: number; url: string; type: string; createdAt: string }> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.httpClient.post<{
      id: number;
      url: string;
      type: string;
      createdAt: string;
    }>(`${this.url}device/${deviceId}/documents/${type}`, fd);
  }

  updateDocumentLabel(
    documentId: number,
    label: string | null,
  ): Observable<{ id: number; label: string | null }> {
    return this.httpClient.patch<{ id: number; label: string | null }>(
      this.url + 'document-uploads/' + documentId,
      { label },
    );
  }
  getDocumentBlob(docId: number): Observable<Blob> {
    return this.httpClient.get(`${this.url}document-uploads/${docId}/url`, {
      responseType: 'blob',
    });
  }

  deleteDocument(deviceId: number, docId: number): Observable<void> {
    return this.httpClient.delete<void>(
      `${this.url}device/${deviceId}/documents/${docId}`,
    );
  }

  /**
   * Emits the full HttpEvent stream (Sent → UploadProgress → Response).
   * Callers that just want the final body should filter on
   * event.type === HttpEventType.Response and read .body. The stream form
   * lets the add-device overlay show upload progress and reset its
   * "stuck submission" safety timer while bytes are flowing.
   */
  public create(data: FormData): Observable<HttpEvent<any>> {
    return this.httpClient.post<any>(this.url + 'device', data, {
      reportProgress: true,
      observe: 'events',
    });
  }
  public update(
    id: any,
    data: FormData | Record<string, any>,
    serialNumberChanged: boolean,
  ): Observable<any> {
    const params = new URLSearchParams({
      serialNumberChanged: serialNumberChanged ? 'true' : 'false',
    });
    const url = `${this.url}device/${id}?${params.toString()}`;
    return this.httpClient.patch<any>(url, data);
  }

  getAllUngroupedDevices(
    searchData?: any,
    orgId?: number,
    pageNumber?: number,
  ): Observable<any> {
    let searchUrl = `${this.url}device/ungrouped?orderBy=Capacity`;
    if (pageNumber) {
      searchUrl += `&pagenumber=${pageNumber}`;
    }
    if (searchData) {
      if (searchData.countryCode) {
        searchUrl += `&country=${searchData.countryCode}`;
      }
      if (searchData.fuelCode) {
        searchUrl += `&fuelCode=${searchData.fuelCode}`;
      }
      if (searchData.deviceTypeCode) {
        searchUrl += `&deviceTypeCode=${searchData.deviceTypeCode}`;
      }
      if (searchData.capacity) {
        searchUrl += `&capacity=${searchData.capacity}`;
      }
      if (searchData.offTaker) {
        searchUrl += `&offTaker=${searchData.offTaker}`;
      }
      if (searchData.SDGBenefits) {
        searchUrl += `&SDGBenefits=${searchData.SDGBenefits}`;
      }
      if (searchData.start_date) {
        searchUrl += `&start_date=${new Date(searchData.start_date).toISOString()}`;
      }
      if (searchData.end_date) {
        searchUrl += `&end_date=${new Date(searchData.end_date).toISOString()}`;
      }
    }
    if (orgId) {
      searchUrl += `&orgId=${orgId}`;
    }
    return this.httpClient.get(searchUrl);
  }

  GetUnreserveDevices(): Observable<any> {
    return this.httpClient.get(this.url + 'device/ungrouped/buyerreservation');
  }

  getfilterData(
    searchData: any,
    orgId: number,
    pagenumber: number,
  ): Observable<any> {
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
    if (orgId) {
      searchUrl += `&organizationId=${orgId}`;
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
  checkSiteName(name: string): Observable<{ exists: boolean }> {
    return this.httpClient.get<{ exists: boolean }>(
      `${this.url}device/check-name?name=${encodeURIComponent(name)}`,
    );
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
