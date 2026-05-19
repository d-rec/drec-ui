import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class MeterReadService {
  url: string = environment.API_URL;

  constructor(private httpClient: HttpClient) {}
  GetMethod(): Observable<any> {
    return this.httpClient.get(this.url + 'certificate-log/redemption-report');
  }
  PostRead(exterenalId: string, data: any): Observable<any> {
    const addUrl = `${this.url}meter-reads/new/` + exterenalId;

    return this.httpClient.post<any>(addUrl, data);
  }

  /** Upload a wide-format meter CSV and turn it into MeterRead rows
   *  for the device. The parser auto-detects which columns carry
   *  production volume (e.g. PV to battery + PV to consumers + PV to
   *  grid for PowerHive-shape exports). Caller can override via the
   *  optional valueColumn / sumColumns / intervalMinutes if the
   *  auto-detect picks the wrong column. */
  ingestCsv(
    externalId: string,
    file: File,
    opts: {
      valueColumn?: string;
      sumColumns?: string[];
      intervalMinutes?: number;
    } = {},
  ): Observable<{
    deviceExternalId: string;
    parsedColumn: string;
    timezone: string;
    unit: string;
    inserted: number;
    skippedEmpty: number;
    skippedZero: number;
    intervalMinutes: number;
  }> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const params = new URLSearchParams();
    if (opts.valueColumn) params.set('valueColumn', opts.valueColumn);
    if (opts.sumColumns?.length)
      params.set('sumColumns', opts.sumColumns.join(','));
    if (opts.intervalMinutes != null)
      params.set('intervalMinutes', String(opts.intervalMinutes));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.httpClient.post<any>(
      `${this.url}meter-reads/csv-ingest/${encodeURIComponent(externalId)}${qs}`,
      fd,
    );
  }

  PostReadByAdmin(
    exterenalId: string,
    data: any,
    organizationId?: number,
  ): Observable<any> {
    let addUrl = `${this.url}meter-reads/addByAdmin/new/` + exterenalId;
    if (organizationId != undefined) {
      addUrl += `?organizationId=${organizationId}`;
    }
    return this.httpClient.post<any>(addUrl, data);
  }
  GetRead(exterenalId: string, data: any): Observable<any> {
    let searchUrl =
      `${this.url}meter-reads/new/` + exterenalId + `?readType=meterReads&`;

    if (
      !(
        typeof data.start === 'undefined' ||
        data.start === '' ||
        data.start === null ||
        data.start === undefined
      )
    ) {
      searchUrl += `start=${new Date(data.start).toISOString()}`;
    }

    if (
      !(
        typeof data.end === 'undefined' ||
        data.end === '' ||
        data.end === null ||
        data.end === undefined
      )
    ) {
      searchUrl += `&end=${new Date(data.end).toISOString()}`;
    }

    if (
      !(
        typeof data.organizationId === 'undefined' ||
        data.organizationId === '' ||
        data.organizationId === null ||
        data.organizationId === undefined
      )
    ) {
      searchUrl += `&organizationId=${data.organizationId}`;
    }

    if (
      !(
        typeof data.pagenumber === 'undefined' ||
        data.pagenumber === '' ||
        data.pagenumber === null
      )
    ) {
      searchUrl += `&pagenumber=${data.pagenumber}`;
    }

    return this.httpClient.get(searchUrl);
  }
  Getlastread(exterenalId: string): Observable<any> {
    return this.httpClient.get(
      this.url + 'meter-reads/latestread/' + exterenalId,
    );
  }
}
